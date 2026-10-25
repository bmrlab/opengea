import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("local verifier authenticates discovery and writes without retrying a rejected Run", async () => {
  const calls = [];
  const server = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    calls.push({ path: request.url, authorization: request.headers.authorization, body: raw && JSON.parse(raw) });
    response.setHeader("content-type", "application/json");
    if (request.url.includes("/agents?"))
      response.end(JSON.stringify({ items: [{ id: "fixture-agent", name: "fixture" }] }));
    else if (request.url === "/api/v1/sessions")
      response.end(JSON.stringify({ id: "fixture-session" }));
    else {
      response.statusCode = 409;
      response.end(JSON.stringify({ error: "fixture_run_rejected" }));
    }
  });
  const cwd = await mkdtemp(join(tmpdir(), "opengea-local-auth-"));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const child = spawn(process.execPath, [fileURLToPath(new URL("verify.mjs", import.meta.url)), "--local"], {
      cwd,
      env: {
        PATH: process.env.PATH,
        GEA_AGENT_ID: "fixture-agent",
        GEA_PROJECT_API_KEY: "synthetic-project-key",
        GEA_LOCAL_AGENTS_API_URL: `http://127.0.0.1:${server.address().port}/api/v1`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => output += chunk);
    const timeout = setTimeout(() => child.kill("SIGKILL"), 10000);
    const [code] = await once(child, "exit");
    clearTimeout(timeout);
    assert.equal(code, 1);
    assert.equal(calls.length, 3);
    assert.ok(calls.every(call => call.authorization === "Bearer synthetic-project-key"));
    assert.equal(calls[0].path, "/api/v1/agents?environment=local");
    assert.equal(calls[1].body.environment, "local");
    assert.equal(calls[1].body.agent_id, "fixture-agent");
    assert.equal(calls[2].path, "/api/v1/sessions/fixture-session/runs");
    assert.deepEqual(Object.keys(calls[2].body).sort(), ["input", "stream"]);
    assert.match(output, /fixture_run_rejected/);
    assert.ok(!output.includes("synthetic-project-key"));
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(cwd, { recursive: true, force: true });
  }
});
