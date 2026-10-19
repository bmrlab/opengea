import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
import { createTestRuntime } from "./runtime";

// The Worker and SQLite are real; the public Agents API is the HTTP system edge.
const agentId = "018f0000-0000-7000-8000-000000000001";
const chatId = "018f0000-0000-7000-8000-000000000002";
const runId = "018f0000-0000-7000-8000-000000000003";
const fileId = "018f0000-0000-7000-8000-000000000004";
const conversation = {
  id: chatId,
  agent_id: agentId,
  environment: "local",
  title: "Local chat",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};
const requests: Array<{ path: string; authorization: unknown; body: string }> =
  [];
let runtime: Awaited<ReturnType<typeof createTestRuntime>>;
let apiOrigin: string;
let sessionCookie = "";
let user = "alice";
let denied = false;
const api = createServer(async (request, response) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString();
  const url = new URL(request.url!, apiOrigin);
  const path = url.pathname;
  requests.push({ path, authorization: request.headers.authorization, body });
  const json = (value: unknown, status = 200) =>
    response
      .writeHead(status, { "content-type": "application/json" })
      .end(JSON.stringify(value));
  if (path.endsWith("/token"))
    return json({
      access_token: `gea_user_${user}`,
      refresh_token: `refresh-${user}`,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid profile offline_access agents:invoke",
      application: { id: agentId },
      authorization: { id: chatId },
      organization: { id: agentId, name: "Fixture org", slug: "fixture" },
    });
  if (path.endsWith("/userinfo"))
    return json({
      sub: request.headers.authorization?.endsWith("bob") ? "bob" : "alice",
      name: "Fixture user",
    });
  if (path.startsWith("/api/v1/") && denied)
    return json({ error: { code: "UNAUTHORIZED" } }, 401);
  if (path === "/api/v1/agents")
    return json({
      items: [
        {
          id: agentId,
          name: "MuseDAMChat",
          description: null,
          environment: "local",
        },
      ],
      next_cursor: null,
    });
  if (path.endsWith("/connections/musedam/authorize"))
    return json({
      authorization_url: `${apiOrigin}/_gea/agent-api/authorization/start?state=ticket`,
      expires_at: new Date(Date.now() + 60000).toISOString(),
    });
  if (path.endsWith("/connections"))
    return json({
      items: [
        {
          key: "musedam",
          name: "MuseDAM",
          owner: "user",
          authorization: "oauth2",
          status: "connected",
          required_scopes: ["musedam"],
          granted_scopes: ["musedam"],
          actions: ["authorize", "disconnect"],
        },
      ],
    });
  if (path === "/api/v1/sessions" && request.method === "POST")
    return json(conversation, 201);
  if (path === `/api/v1/sessions/${chatId}`) return json(conversation);
  if (path === `/api/v1/sessions/${chatId}/runs`) {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "x-vercel-ai-ui-message-stream": "v1",
      "x-gea-agent-session-id": chatId,
      "x-gea-agent-run-id": runId,
    });
    return response.end(
      'data: {"type":"start","messageId":"answer"}\n\ndata: {"type":"finish"}\n\ndata: [DONE]\n\n',
    );
  }
  if (path === `/api/v1/runs/${runId}`)
    return json({ id: runId, session_id: chatId, status: "completed" });
  if (path.endsWith("/messages"))
    return json({
      items: [
        {
          id: "answer",
          role: "assistant",
          parts: [{ type: "text", text: "Local answer" }],
        },
      ],
      next_cursor: null,
    });
  if (path === "/api/v1/files")
    return json(
      {
        id: fileId,
        filename: "note.txt",
        media_type: "text/plain",
        size: 5,
        title: "note.txt",
        created_at: new Date().toISOString(),
        deleted_at: null,
      },
      201,
    );
  return json({ message: "Unexpected fixture request" }, 404);
});
const call = (path: string, body?: unknown, origin = "http://localhost:4000") =>
  runtime.fetch(
    new Request(`http://localhost:4000${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        origin,
        cookie: sessionCookie,
        ...(body instanceof FormData
          ? {}
          : { "content-type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    }),
  );
beforeAll(async () => {
  api.listen(0, "127.0.0.1");
  await once(api, "listening");
  const address = api.address();
  if (!address || typeof address === "string") throw new Error("No API port");
  apiOrigin = `http://127.0.0.1:${address.port}`;
  runtime = await createTestRuntime({
    APP_ORIGIN: "http://localhost:4000",
    AGENT_ENVIRONMENT: "local",
    LOCAL_AGENTS_API_URL: apiOrigin,
    // A stale service token must never replace the logged-in user.
    LOCAL_AGENTS_API_TOKEN: "synthetic-local-project-key",
    OAUTH_ISSUER_URL: apiOrigin,
    OAUTH_CLIENT_ID: "fixture-client",
    OAUTH_CLIENT_SECRET: "fixture-secret",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  });
}, 30000);
afterAll(async () => {
  await runtime?.dispose();
  api.closeAllConnections();
  await new Promise<void>((resolve) => api.close(() => resolve()));
});
async function signIn(name: string) {
  user = name;
  const flow = await call("/auth/login", {});
  expect(flow.status).toBe(303);
  sessionCookie = flow.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const location = new URL(flow.headers.get("location")!);
  const response = await call(
    `/auth/callback?code=fixture&state=${location.searchParams.get("state")}`,
  );
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("http://localhost:4000/");
  sessionCookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .filter((value) => !value.endsWith("="))
    .join("; ");
}
it("requires an OAuth login in local mode, without a local-user or service fallback", async () => {
  expect((await call("/api/session")).status).toBe(401);
  expect(
    (await call("/api/conversations", { agentId, title: "Anonymous" })).status,
  ).toBe(401);
});
it("preserves the OAuth user for local discovery, connections, files and a recoverable chat", async () => {
  await signIn("alice");
  const session = await call("/api/session");
  expect(session.status).toBe(200);
  expect(await session.json()).toMatchObject({
    environment: "local",
    user: { sub: "alice" },
    agents: [{ id: agentId }],
  });
  const created = await call("/api/conversations", {
    agentId,
    title: "Local chat",
  });
  expect(created.status).toBe(201);
  const form = new FormData();
  form.set("file", new File(["hello"], "note.txt", { type: "text/plain" }));
  expect((await call(`/api/files?chatId=${chatId}`, form)).status).toBe(201);
  const run = await call("/api/chat", {
    chatId,
    message: "Read file",
    fileIds: [fileId],
  });
  expect(run.status).toBe(200);
  expect(await run.text()).toContain("[DONE]");
  await runtime.restart();
  const history = await call(`/api/chat?chatId=${chatId}`);
  expect(history.status).toBe(200);
  expect(await history.json()).toMatchObject({
    run: { id: runId },
    messages: [{ parts: [{ text: "Local answer" }] }],
  });
  const authorize = await call(
    `/api/connections/authorize?agentId=${agentId}&key=musedam`,
    {},
  );
  expect(authorize.status).toBe(303);
  expect(authorize.headers.get("location")).toContain(
    "/_gea/agent-api/authorization/start",
  );
  expect(
    requests
      .filter((request) => request.path.startsWith("/api/v1/"))
      .every((request) => request.authorization === "Bearer gea_user_alice"),
  ).toBe(true);
  expect(
    JSON.parse(
      requests.find((request) => request.path === "/api/v1/sessions")!.body,
    ).environment,
  ).toBe("local");
  const aliceCookie = sessionCookie;
  await signIn("bob");
  const bob = await call("/api/session");
  expect(await bob.json()).toMatchObject({ user: { sub: "bob" } });
  expect(requests.at(-1)?.authorization).toBe("Bearer gea_user_bob");
  sessionCookie = aliceCookie;
  denied = true;
  expect((await call("/api/session")).status).toBe(401);
  expect(requests.at(-1)?.authorization).toBe("Bearer gea_user_alice");
  denied = false;
});
it("refuses local API mode on a public application origin", async () => {
  await runtime.restart({ APP_ORIGIN: "https://example.com" });
  expect((await call("/api/session")).status).toBe(502);
});
