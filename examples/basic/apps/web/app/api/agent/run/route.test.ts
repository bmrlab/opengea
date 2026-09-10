import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest";
vi.mock("server-only", () => ({}));
import { POST } from "./route";

let server: Server;
let upstreamUrl: string;
let lastBody: unknown;
let lastHeaders: import("node:http").IncomingHttpHeaders;
let calls = 0;
let fail = false;
const origin = "http://localhost:3000";
const chatId = randomUUID();
const runId = randomUUID();
beforeAll(async () => {
  server = createServer(async (request, response) => {
    calls++;
    lastHeaders = request.headers;
    let body = "";
    for await (const chunk of request) body += chunk;
    lastBody = JSON.parse(body);
    response.writeHead(fail ? 503 : 200, {
      "content-type": fail ? "application/json" : "text/event-stream",
      "x-gea-agent-chat-id": chatId,
      "x-gea-agent-run-id": runId,
      "x-gea-request-id": randomUUID(),
      "x-vercel-ai-ui-message-stream": "v1",
      "set-cookie": "private-upstream=secret",
    });
    response.write(
      fail
        ? '{"message":"Unavailable"}'
        : 'data: {"type":"start","messageId":"reply"}\n\n',
    );
    // A delayed tail proves that the handler does not buffer the upstream body.
    setTimeout(() => response.end(fail ? "" : "data: [DONE]\n\n"), 150);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test listener");
  upstreamUrl = `http://127.0.0.1:${address.port}/gea/agents/tech-news`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
beforeEach(() => {
  calls = 0;
  fail = false;
  vi.stubEnv("APP_ORIGIN", origin);
  vi.stubEnv(
    "SESSION_SECRET",
    "test-only-session-secret-with-more-than-32-characters",
  );
  vi.stubEnv("GEA_MODE", "local");
  vi.stubEnv("GEA_AGENT_URL", upstreamUrl);
  vi.stubEnv("GEA_PROJECT_API_KEY", "");
});
function request(body: unknown, cookie?: string, requestOrigin = origin) {
  return new Request(`${origin}/api/agent/run`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: requestOrigin,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
test("first and subsequent turns stream with owned Chat IDs and no browser credentials upstream", async () => {
  const first = await POST(request({ message: "Find TypeScript stories" }));
  expect(first.status).toBe(200);
  expect(first.headers.get("x-gea-agent-chat-id")).toBe(chatId);
  expect(first.headers.get("x-gea-agent-run-id")).toBe(runId);
  expect(first.headers.get("x-gea-request-id")).toBeTruthy();
  expect(first.headers.get("cache-control")).toBe("no-store");
  expect(cookies(first)).not.toContain("private-upstream");
  expect(lastHeaders.authorization).toBeUndefined();
  expect(lastHeaders.cookie).toBeUndefined();
  expect(lastBody).toEqual({ message: "Find TypeScript stories" });
  const reader = first.body!.getReader();
  expect(new TextDecoder().decode((await reader.read()).value)).toContain(
    '"type":"start"',
  );
  const second = await POST(
    request({ chatId, message: "Explain the first result" }, cookies(first)),
  );
  expect(second.status).toBe(200);
  expect(lastBody).toEqual({ chatId, message: "Explain the first result" });
  await second.text();
  await reader.cancel();
});
test("a second anonymous visitor and a forged cookie cannot continue another visitor's Chat", async () => {
  const first = await POST(request({ message: "Search SQLite" }));
  await first.text();
  const denied = await POST(request({ chatId, message: "Read it" }));
  expect(denied.status).toBe(404);
  const forged = await POST(
    request({ chatId, message: "Read it" }, `${cookies(first)}invalid`),
  );
  expect(forged.status).toBe(404);
  expect(calls).toBe(1);
});

test("approval decisions require Chat ownership and preserve the assistant continuation", async () => {
  const first = await POST(request({ message: "Search with approval" }));
  await first.text();
  const message = {
    id: randomUUID(),
    role: "assistant",
    parts: [
      {
        type: "tool-searchStories",
        toolCallId: "search-call",
        state: "approval-responded",
        input: { query: "TypeScript", limit: 3 },
        approval: { id: "approval-id", approved: false },
      },
    ],
  };
  const denied = await POST(request({ chatId, message }));
  expect(denied.status).toBe(404);
  expect(calls).toBe(1);
  const continued = await POST(request({ chatId, message }, cookies(first)));
  expect(continued.status).toBe(200);
  expect(lastBody).toEqual({ chatId, message });
  await continued.text();
});
test("rejects cross-origin writes and browser-supplied identity, metadata and upstream selection", async () => {
  expect(
    (
      await POST(
        request({ message: "Hello" }, undefined, "https://attacker.example"),
      )
    ).status,
  ).toBe(403);
  for (const extra of [
    { userId: "admin" },
    { metadata: { userId: "admin" } },
    { api: "https://attacker.example" },
    { apiKey: "browser-key" },
  ]) {
    expect((await POST(request({ message: "Hello", ...extra }))).status).toBe(
      400,
    );
  }
  expect(calls).toBe(0);
});
test("retains ownership when startup fails after a Chat is created, with no retry", async () => {
  fail = true;
  const response = await POST(request({ message: "Hello" }));
  expect(response.status).toBe(503);
  expect(response.headers.get("x-gea-agent-chat-id")).toBe(chatId);
  await response.text();
  expect(calls).toBe(1);
  fail = false;
  const continued = await POST(
    request({ chatId, message: "Try another question" }, cookies(response)),
  );
  expect(continued.status).toBe(200);
  await continued.text();
});
test("Chat grants are scoped to the configured Agent destination", async () => {
  const first = await POST(request({ message: "Hello" }));
  await first.text();
  vi.stubEnv(
    "GEA_AGENT_URL",
    upstreamUrl.replace("tech-news", "another-agent"),
  );
  expect(
    (await POST(request({ chatId, message: "Hello" }, cookies(first)))).status,
  ).toBe(404);
  expect(calls).toBe(1);
});

test("hosted calls use the configured key and server-owned metadata, never browser credentials", async () => {
  vi.stubEnv("GEA_MODE", "hosted");
  vi.stubEnv("GEA_AGENT_URL", "https://agent.example/gea/agents/tech-news");
  vi.stubEnv("GEA_PROJECT_API_KEY", "test-server-project-key");
  vi.stubEnv("APP_ORIGIN", "https://news.example");
  const upstream = vi.fn<typeof fetch>(async (url, init) => {
    expect(url).toBe("https://agent.example/gea/agents/tech-news/run");
    const headers = new Headers(init?.headers);
    expect(headers.get("authorization")).toBe("Bearer test-server-project-key");
    expect(headers.has("cookie")).toBe(false);
    expect(init?.redirect).toBe("error");
    const body = JSON.parse(String(init?.body));
    expect(body.metadata.application).toBe("opengea-basic");
    expect(body.metadata.anonymousSessionId).toMatch(/^[a-f0-9-]{36}$/);
    return new Response("data: [DONE]\n\n", {
      headers: {
        "x-gea-agent-chat-id": chatId,
        "set-cookie": "upstream=private",
        authorization: "upstream-secret",
      },
    });
  });
  vi.stubGlobal("fetch", upstream);
  const input = request(
    { message: "Search TypeScript" },
    "external-cookie=private",
    "https://news.example",
  );
  input.headers.set("authorization", "Bearer browser-key");
  const response = await POST(input);
  expect(response.status).toBe(200);
  expect(response.headers.has("authorization")).toBe(false);
  expect(
    response.headers
      .getSetCookie()
      .every(
        (cookie) => cookie.includes("HttpOnly") && cookie.includes("Secure"),
      ),
  ).toBe(true);
  expect(JSON.stringify([...response.headers])).not.toContain(
    "test-server-project-key",
  );
  expect(await response.text()).toBe("data: [DONE]\n\n");
  expect(upstream).toHaveBeenCalledTimes(1);
});

test("network errors return a generic response without retrying or exposing secrets", async () => {
  const upstream = vi.fn<typeof fetch>(async () => {
    throw new Error("secret-transport-detail");
  });
  vi.stubGlobal("fetch", upstream);
  const response = await POST(request({ message: "Hello" }));
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("secret-transport-detail");
  expect(upstream).toHaveBeenCalledTimes(1);
});
