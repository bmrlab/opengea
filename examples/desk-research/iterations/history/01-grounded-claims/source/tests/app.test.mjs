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
