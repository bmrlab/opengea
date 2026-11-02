import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verify } from "./verify.mjs";

test("reads the foreign child from hosted API and rejects denied access", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "remote-verifier-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.mock.method(console, "log", () => {});
  let marker;
  let denyChild = false;
  const parent = {
    id: "parent-run",
    session_id: "parent-session",
    status: "finished",
  };
  const child = {
    id: "child-run",
    session_id: "child-session",
    parent_run_id: null,
    status: "finished",
  };
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(options.headers.authorization, "Bearer synthetic-user-oauth");
    const request = new URL(url);
    if (request.origin === "http://127.0.0.1:8797") {
      if (options.method === "POST" && request.pathname === "/api/v1/sessions")
        return Response.json({ id: parent.session_id });
      if (
        options.method === "POST" &&
        request.pathname === "/api/v1/sessions/parent-session/runs"
      ) {
        marker = JSON.parse(options.body).input.match(
          /REMOTE_SMOKE_[\w-]+/u,
        )[0];
        return Response.json(parent);
      }
      if (request.pathname === "/api/v1/runs/parent-run")
        return Response.json(parent);
      if (request.pathname === "/api/v1/sessions/parent-session/messages")
        return Response.json({
          items: [
            {
              role: "assistant",
              parts: [
                {
                  type: "tool-agent",
                  state: "output-available",
                  input: { target: "musedam" },
                  output: { runId: child.id, sessionId: child.session_id },
                },
                {
                  type: "tool-runWait",
                  state: "output-available",
                  input: { runIds: [child.id] },
                  output: {
                    runs: [
                      {
                        runId: child.id,
                        sessionId: child.session_id,
                        status: "finished",
                        text: marker,
                      },
                    ],
                  },
                },
                { type: "text", text: marker },
              ],
            },
          ],
        });
    }
    if (request.origin === "https://hosted.example") {
      if (denyChild) return new Response(null, { status: 403 });
      if (request.pathname === "/api/v1/runs/child-run")
        return Response.json(child);
      if (request.pathname === "/api/v1/sessions/child-session")
        return Response.json({
          id: child.session_id,
          agent_id: "hosted-target",
        });
      if (request.pathname === "/api/v1/sessions/child-session/messages")
        return Response.json({
          items: [
            { role: "assistant", parts: [{ type: "text", text: marker }] },
          ],
        });
    }
    return new Response(null, { status: 404 });
  });
  const input = {
    api: "http://127.0.0.1:8797/api/v1",
    remoteApi: "https://hosted.example/api/v1",
    token: "synthetic-user-oauth",
    callerId: "local-caller",
    targetId: "hosted-target",
    environment: "local",
  };
  const passed = await verify({
    ...input,
    directory: path.join(root, "passed"),
  });
  assert.equal(passed.status, "passed");
  assert.equal(passed.remoteTransport, true);
  denyChild = true;
  await assert.rejects(
    verify({ ...input, directory: path.join(root, "denied") }),
    /HTTP 403/u,
  );
  const failed = JSON.parse(
    await readFile(path.join(root, "denied/report.json"), "utf8"),
  );
  assert.equal(failed.status, "failed");
  assert.equal(failed.receipt.runId, child.id);
});
