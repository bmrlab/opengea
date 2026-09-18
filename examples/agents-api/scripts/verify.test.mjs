import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";

async function verifyAgainst(handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, ["scripts/verify.mjs"], {
      env: {
        ...process.env,
        GEA_AGENTS_API_URL: `http://127.0.0.1:${server.address().port}/api/v1`,
        GEA_ENVIRONMENT: "local",
        GEA_AGENT_ID: "fixture-agent",
        GEA_ACCESS_TOKEN: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 15_000,
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    const [code] = await once(child, "exit");
    return { code, output };
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

test("verification recovers from a rate-limited discovery GET", async () => {
  let calls = 0;
  const result = await verifyAgainst((request, response) => {
    assert.equal(request.method, "GET");
    assert.equal(request.url, "/api/v1/agents?environment=local");
    calls++;
    response.setHeader("content-type", "application/json");
    if (calls === 1) {
      response.writeHead(429, { "retry-after": "1" });
      response.end(JSON.stringify({ error: { code: "TOO_MANY_REQUESTS" } }));
    } else {
      // Stop after discovery; this fixture performs no model calls or writes.
      response.end(JSON.stringify({ items: [] }));
    }
  });
  assert.equal(calls, 2);
  assert.equal(result.code, 1);
  assert.match(result.output, /Publish\/start this example/);
});

test("verification never retries a rate-limited Session creation", async () => {
  let writes = 0;
  const result = await verifyAgainst((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.method === "GET") {
      response.end(JSON.stringify({ items: [{ id: "fixture-agent" }] }));
    } else {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/api/v1/sessions");
      writes++;
      response.writeHead(429, { "retry-after": "1" });
      response.end(JSON.stringify({ error: { code: "TOO_MANY_REQUESTS" } }));
    }
  });
  assert.equal(writes, 1);
  assert.equal(result.code, 1);
  assert.match(result.output, /POST \/sessions: HTTP 429/);
});
