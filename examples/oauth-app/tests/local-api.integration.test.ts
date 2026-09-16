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
  });
}, 30000);
afterAll(async () => {
  await runtime?.dispose();
  api.closeAllConnections();
  await new Promise<void>((resolve) => api.close(() => resolve()));
});
it("uses the local API without OAuth for discovery, connections, files and a recoverable chat", async () => {
  const session = await call("/api/session");
  expect(session.status).toBe(200);
  expect(await session.json()).toMatchObject({
    environment: "local",
    user: { sub: "local-user" },
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
  expect(requests.every((request) => request.authorization === undefined)).toBe(
    true,
  );
  expect(
    JSON.parse(
      requests.find((request) => request.path === "/api/v1/sessions")!.body,
    ).environment,
  ).toBe("local");
  expect(
    (await call("/api/session", undefined, "https://untrusted.example")).status,
  ).toBe(403);
});
it("refuses local single-user mode on a public application origin", async () => {
  await runtime.restart({ APP_ORIGIN: "https://example.com" });
  expect((await call("/api/session")).status).toBe(502);
});
