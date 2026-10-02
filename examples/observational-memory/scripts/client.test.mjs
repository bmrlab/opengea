import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import * as client from "./client.mjs";

async function fixture(t, handler) {
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const result = handler(request.method, request.url, body && JSON.parse(body));
    response.writeHead(result.status ?? 200, {
      "content-type": "application/json",
    });
    response.end(
      typeof result.body === "string" ? result.body : JSON.stringify(result.body),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/v1`;
}
const stream =
  [
    { type: "text-delta", delta: "done" },
    {
      type: "finish",
      finishReason: "stop",
      messageMetadata: { modelCalls: [{ source: "agent" }] },
    },
  ]
    .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
    .join("") + "data: [DONE]\n\n";

test("history follows public API cursors and preserves messages", async (t) => {
  const paths = [];
  const url = await fixture(t, (_, path) => {
    paths.push(path);
    return {
      body:
        paths.length === 1
          ? { items: [{ id: "first" }], next_cursor: "a/b" }
          : { items: [{ id: "second" }], next_cursor: null },
    };
  });
  assert.deepEqual(await client.readHistory(url, "session"), [
    { id: "first" },
    { id: "second" },
  ]);
  assert.deepEqual(paths, [
    "/api/v1/sessions/session/messages?limit=100",
    "/api/v1/sessions/session/messages?limit=100&cursor=a%2Fb",
  ]);
});

test("creates missing Session once, then reuses it for the next Run", async (t) => {
  let exists = false;
  const writes = [];
  const url = await fixture(t, (method, path, body) => {
    if (method === "POST") writes.push({ path, body });
    if (path === "/api/v1/agents?environment=local")
      return { body: { items: [{ name: "raw", id: "agent" }] } };
    if (path === "/api/v1/sessions/session")
      return { status: exists ? 200 : 404, body: {} };
    if (path === "/api/v1/sessions") {
      exists = true;
      return { body: { id: "session" } };
    }
    return { body: stream };
  });
  assert.equal(
    (await client.runTurn(url, "raw", "session", "hello")).text,
    "done",
  );
  await client.runTurn(url, "raw", "session", "again");
  assert.deepEqual(writes, [
    {
      path: "/api/v1/sessions",
      body: { id: "session", agent_id: "agent", environment: "local" },
    },
    {
      path: "/api/v1/sessions/session/runs",
      body: { input: "hello", stream: true },
    },
    {
      path: "/api/v1/sessions/session/runs",
      body: { input: "again", stream: true },
    },
  ]);
});

test("failed Session reads cannot create Sessions or submit Runs", async (t) => {
  const methods = [];
  const url = await fixture(t, (method) => {
    methods.push(method);
    return { status: 503, body: {} };
  });
  await assert.rejects(
    client.runTurn(url, "raw", "session", "hello"),
    /Session read failed: 503/,
  );
  assert.deepEqual(methods, ["GET"]);
});

test("rejected Run is not retried", async (t) => {
  let writes = 0;
  const url = await fixture(t, (method) => {
    if (method === "POST") {
      writes++;
      return { status: 429, body: {} };
    }
    return { body: {} };
  });
  await assert.rejects(
    client.runTurn(url, "raw", "session", "hello"),
    /Run failed \(429\)/,
  );
  assert.equal(writes, 1);
});
