import assert from "node:assert/strict";
import test from "node:test";
import { createWorkbench } from "../app/server.mjs";

test("workbench rejects cross-origin writes and never exposes credentials", async () => {
  const calls = [];
  const server = createWorkbench({
    agentId: "00000000-0000-4000-8000-000000000001",
    apiOrigin: "http://127.0.0.1:18001",
    workerOrigin: "http://127.0.0.1:18002",
    apiKey: "test-api-key",
    viewToken: "test-view-token",
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return Response.json({ items: [] });
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(
      (
        await fetch(`${origin}/api/sessions`, {
          method: "POST",
          headers: { origin: "https://unrelated.example" },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal(calls.length, 0);
    const response = await fetch(`${origin}/api/research`);
    assert.equal(response.status, 200);
    assert.equal((await response.text()).includes("test-view-token"), false);
    assert.equal(calls[0].init.headers.authorization, "Bearer test-view-token");
    assert.equal(calls[0].init.redirect, "error");
    assert.equal(
      (await fetch(`${origin}/api/proxy?url=https://unrelated.example`)).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("rejects arbitrary upstream origins before reading credentials", () => {
  assert.throws(
    () =>
      createWorkbench({
        agentId: "00000000-0000-4000-8000-000000000001",
        apiOrigin: "https://remote.example",
        workerOrigin: "http://127.0.0.1:18002",
        apiKey: "test",
        viewToken: "test",
      }),
    /loopback/,
  );
});

test("workbench uses the local Session contract and exposes Run completion lookup", async () => {
  const id = "00000000-0000-4000-8000-000000000002";
  const server = createWorkbench({
    agentId: id,
    apiOrigin: "http://127.0.0.1:18001",
    workerOrigin: "http://127.0.0.1:18002",
    apiKey: "test",
    viewToken: "test",
    fetch: async (url, init) => {
      if (new URL(url).pathname === "/api/v1/sessions") {
        const body = JSON.parse(init.body);
        return body.environment === "local"
          ? Response.json({ id }, { status: 201 })
          : Response.json({ error: "invalid environment" }, { status: 400 });
      }
      if (new URL(url).pathname === `/api/v1/runs/${id}`)
        return Response.json({ id, status: "finished" });
      return Response.json({ error: "unexpected route" }, { status: 404 });
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const created = await fetch(origin + "/api/sessions", {
      method: "POST",
      headers: { origin },
      body: "{}",
    });
    assert.equal(created.status, 201);
    const run = await fetch(origin + "/api/runs/" + id);
    assert.equal(run.status, 200);
    assert.equal((await run.json()).status, "finished");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
