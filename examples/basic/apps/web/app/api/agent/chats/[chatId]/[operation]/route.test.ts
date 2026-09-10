import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { GET, POST } from "./route";
import {
  chatCookie,
  newSession,
  sessionCookie,
  setClaims,
} from "../../../../../../server/session";

const chatId = randomUUID();
const runId = randomUUID();
const origin = "http://localhost:3000";
const api = "https://worker.example.com/gea/agents/tech-news";
const secret = "local-conversation-test-secret-20260910";
const message = {
  id: randomUUID(),
  role: "assistant",
  parts: [{ type: "text", text: "Earlier answer" }],
};
let cookie: string;
let foreignRun = false;
let upstreamFailure = false;
const calls: { url: string; method: string }[] = [];

beforeEach(() => {
  calls.length = 0;
  foreignRun = false;
  upstreamFailure = false;
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv("SESSION_SECRET", secret);
  vi.stubEnv("GEA_MODE", "hosted");
  vi.stubEnv("GEA_AGENT_URL", api);
  vi.stubEnv("GEA_PROJECT_API_KEY", "server-key");
  const session = newSession();
  const headers = new Headers();
  setClaims(headers, sessionCookie, session, secret, false);
  setClaims(
    headers,
    chatCookie(chatId),
    { ...session, chatId, runId, audience: api },
    secret,
    false,
  );
  cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method! });
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer server-key",
    );
    expect(new Headers(init.headers).has("cookie")).toBe(false);
    if (upstreamFailure) throw new Error("private upstream details");
    if (url.endsWith("/cancel"))
      return Response.json({ status: "abort_requested" });
    if (url.includes("/runs/"))
      return Response.json({
        id: runId,
        chatId: foreignRun ? randomUUID() : chatId,
        status: "running",
      });
    return Response.json({ items: [message], nextCursor: null });
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const context = (operation: string) => ({
  params: Promise.resolve({ chatId, operation }),
});
const request = (operation: string, owned = true, requestOrigin = origin) =>
  new Request(`${origin}/api/agent/chats/${chatId}/${operation}`, {
    method: operation === "cancel" ? "POST" : "GET",
    headers: {
      origin: requestOrigin,
      "content-type": "application/json",
      ...(owned ? { cookie } : {}),
    },
    ...(operation === "cancel" ? { body: JSON.stringify({ runId }) } : {}),
  });

test("history and cancellation require ownership before contacting GEA", async () => {
  for (const operation of ["state", "cancel"]) {
    const response = await (operation === "cancel" ? POST : GET)(
      request(operation, false),
      context(operation),
    );
    expect(response.status).toBe(404);
  }
  expect(calls).toHaveLength(0);
});
test("cross-origin cancellation and another Chat's Run cannot create a cancellation effect", async () => {
  expect(
    (
      await POST(
        request("cancel", true, "https://other.example"),
        context("cancel"),
      )
    ).status,
  ).toBe(403);
  expect(calls).toHaveLength(0);
  foreignRun = true;
  expect((await POST(request("cancel"), context("cancel"))).status).toBe(404);
  expect(calls).toEqual([{ url: `${api}/runs/${runId}`, method: "GET" }]);
});
test("owned cancellation acknowledges intent without claiming the Run already stopped", async () => {
  const response = await POST(request("cancel"), context("cancel"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: "abort_requested" });
  expect(calls).toEqual([
    { url: `${api}/runs/${runId}`, method: "GET" },
    { url: `${api}/runs/${runId}/cancel`, method: "POST" },
  ]);
});
test("malformed cancellation JSON fails before any upstream request", async () => {
  const response = await POST(
    new Request(`${origin}/api/agent/chats/${chatId}/cancel`, {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      body: "{",
    }),
    context("cancel"),
  );
  expect(response.status).toBe(400);
  expect(calls).toHaveLength(0);
});
test("restore returns validated persisted messages and the owned Run status", async () => {
  const response = await GET(request("state"), context("state"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    messages: [message],
    run: { id: runId, chatId, status: "running" },
    hasOlderMessages: false,
  });
});
test("full stream replay is unavailable until its history merge contract is supported", async () => {
  const response = await GET(request("stream"), context("stream"));
  expect(response.status).toBe(404);
  expect(calls).toHaveLength(0);
});
test("local mode does not pretend to provide hosted lifecycle endpoints", async () => {
  vi.stubEnv("GEA_MODE", "local");
  vi.stubEnv("GEA_AGENT_URL", "http://127.0.0.1:8787/gea/agents/tech-news");
  // Existing grants for another configured Agent must fail before capability checks.
  expect((await GET(request("state"), context("state"))).status).toBe(404);
  const session = newSession();
  const headers = new Headers();
  setClaims(headers, sessionCookie, session, secret, false);
  setClaims(
    headers,
    chatCookie(chatId),
    {
      ...session,
      chatId,
      audience: "http://127.0.0.1:8787/gea/agents/tech-news",
    },
    secret,
    false,
  );
  cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect((await GET(request("state"), context("state"))).status).toBe(501);
  expect(calls).toHaveLength(0);
});
test("transport failures remain failures and do not expose private error details", async () => {
  upstreamFailure = true;
  const response = await GET(request("state"), context("state"));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private upstream details");
});
