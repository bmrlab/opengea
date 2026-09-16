import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { createTestRuntime } from "./runtime";

// Real Worker HTTP routes and SQLite Durable Objects, with only GEA/provider HTTP simulated.
let runtime: Awaited<ReturnType<typeof createTestRuntime>>;
let server: Server;
let origin: string;
let app: typeof import("../server/routes");
let exchanges: URLSearchParams[] = [];
let refreshes: string[] = [];
let revoked: string[] = [];
let revokeFails = false;
let refreshFails = false;
let calls = 0;
let failedRun = false;
let runStopped = false;
let denied = false;
let musedamConnected = true;
let connectionStatus: string | undefined;
let connectionOwner = "user";
let hasConnector = true;
let connectionsFail = false;
let providerUser = "initial";
let onRefresh: (() => void) | undefined;
const connectionBearers: string[] = [];
let createFails = false;
let contentGone = false;
const apiRequests: { method: string; path: string; body: unknown }[] = [];
const disabledAccessTokens = new Set<string>();
const ids = {
  app: "018f0000-0000-7000-8000-000000000001",
  authorization: "018f0000-0000-7000-8000-000000000002",
  org: "018f0000-0000-7000-8000-000000000003",
  chat: "018f0000-0000-7000-8000-000000000004",
  run: "018f0000-0000-7000-8000-000000000005",
  agent: "018f0000-0000-7000-8000-000000000006",
  older: "018f0000-0000-7000-8000-000000000007",
  file: "018f0000-0000-7000-8000-000000000008",
  artifact: "018f0000-0000-7000-8000-000000000009",
};
function tokens(suffix = providerUser) {
  return {
    access_token: `access-${suffix}`,
    refresh_token: `refresh-${suffix}`,
    token_type: "Bearer",
    expires_in: 3600,
    scope: "openid profile offline_access agents:invoke",
    application: { id: ids.app },
    authorization: { id: ids.authorization },
    organization: {
      id: ids.org,
      name: "Verified organization",
      slug: "verified",
    },
  };
}
function request(path: string, cookie = "", body?: unknown) {
  return new Request(`http://localhost:4000${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      cookie,
      origin: "http://localhost:4000",
      "content-type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const cookie = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((c) => c.split(";", 1)[0])
    .filter((c) => c && !c.endsWith("="))
    .join("; ");
async function begin() {
  const response = await app.login(request("/auth/login", "", {}));
  expect(response.status, await response.clone().text()).toBe(303);
  const url = new URL(response.headers.get("location")!);
  return { response, url, cookie: cookie(response) };
}
async function signIn() {
  const flow = await begin();
  const response = await app.callback(
    request(
      `/auth/callback?state=${flow.url.searchParams.get("state")}&code=good`,
      flow.cookie,
    ),
  );
  expect(response.headers.get("location")).toBe("http://localhost:4000/");
  return cookie(response);
}
const conversation = (id = ids.chat) => ({
  id,
  object: "agent.session",
  agent_id: ids.agent,
  environment: "production",
  title: id === ids.chat ? "Hello" : "Older conversation",
  metadata: {},
  created_at: "2026-09-14T00:00:00.000Z",
  updated_at: "2026-09-14T00:00:00.000Z",
});
const fileRecord = (id = ids.file) => ({
  id,
  object: "file",
  filename: "notes.txt",
  media_type: "text/plain",
  size: 4,
  title: "Notes",
  created_at: "2026-09-15T00:00:00.000Z",
  deleted_at: null,
});
const artifactRecord = () => ({
  ...fileRecord(ids.artifact),
  object: "artifact",
  session_id: ids.chat,
  run_id: ids.run,
});
function uploadRequest(
  cookies: string,
  file = new File([new Uint8Array([0, 255, 128, 1])], "notes.txt", {
    type: "text/plain",
  }),
) {
  const form = new FormData();
  form.set("file", file);
  form.set("environment", "preview"); // The app's configured environment wins.
  return new Request(`http://localhost:4000/api/files?chatId=${ids.chat}`, {
    method: "POST",
    headers: { cookie: cookies, origin: "http://localhost:4000" },
    body: form,
  });
}
beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    const body = new URLSearchParams(raw);
    const url = new URL(req.url!, "http://provider");
    if (url.pathname.startsWith("/api/v1")) {
      let payload: unknown = raw
        ? req.headers["content-type"]?.startsWith("multipart/form-data")
          ? null
          : JSON.parse(raw)
        : null;
      if (req.headers["content-type"]?.startsWith("multipart/form-data")) {
        const form = await new Request("http://provider/upload", {
          method: "POST",
          headers: { "content-type": req.headers["content-type"] },
          body: Buffer.concat(chunks),
        }).formData();
        const file = form.get("file") as File;
        payload = {
          environment: form.get("environment"),
          filename: file.name,
          media_type: file.type,
          bytes: [...new Uint8Array(await file.arrayBuffer())],
        };
      }
      apiRequests.push({ method: req.method!, path: req.url!, body: payload });
      if (!req.headers.authorization?.startsWith("Bearer access-") || denied) {
        res.statusCode = denied ? 404 : 401;
        res.end(
          JSON.stringify({
            error: { code: "NOT_FOUND", message: "private upstream detail" },
          }),
        );
        return;
      }
    }
    res.setHeader("content-type", "application/json");
    if (req.url?.endsWith("/token")) {
      expect(req.headers.authorization).toBe(
        `Basic ${Buffer.from("test-client:test-secret").toString("base64")}`,
      );
      if (body.get("grant_type") === "refresh_token") {
        refreshes.push(body.get("refresh_token")!);
        onRefresh?.();
        await new Promise((resolve) => setTimeout(resolve, 40));
        if (refreshFails) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: "temporarily_unavailable" }));
          return;
        }
        res.end(JSON.stringify(tokens(`rotated-${refreshes.length}`)));
      } else {
        exchanges.push(body);
        res.end(JSON.stringify(tokens()));
      }
    } else if (req.url?.endsWith("/userinfo")) {
      if (
        disabledAccessTokens.has(
          req.headers.authorization?.replace("Bearer ", "") ?? "",
        )
      ) {
        res.statusCode = 401;
        res.end("{}");
        return;
      }
      res.end(
        JSON.stringify({
          sub:
            req.headers.authorization === "Bearer access-other"
              ? "other-user"
              : "pairwise-user",
          name: "Test user",
        }),
      );
    } else if (req.url?.endsWith("/revoke")) {
      if (revokeFails) {
        res.statusCode = 503;
        res.end("{}");
        return;
      }
      const token = body.get("token")!;
      if (disabledAccessTokens.has(token)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: "invalid_request" }));
        return;
      }
      revoked.push(token);
      if (body.get("token_type_hint") === "refresh_token")
        disabledAccessTokens.add(token.replace("refresh-", "access-"));
      res.end("{}");
    } else if (url.pathname === `/api/v1/agents/${ids.agent}/connections`) {
      connectionBearers.push(req.headers.authorization!);
      if (connectionsFail) {
        res.statusCode = 503;
        res.end("{}");
        return;
      }
      res.end(
        JSON.stringify({
          items: hasConnector
            ? [
                {
                  key: "musedam",
                  name: "MuseDAM",
                  owner: connectionOwner,
                  authorization: "oauth2",
                  status:
                    connectionStatus ??
                    (musedamConnected ? "connected" : "authorization_required"),
                  required_scopes: ["musedam"],
                  granted_scopes: musedamConnected ? ["musedam"] : null,
                  actions:
                    connectionStatus === "administrator_configuration_required"
                      ? []
                      : ["authorize"],
                  connection_id: null,
                  revision: null,
                  private_provider_detail: "never-expose",
                },
              ]
            : [],
        }),
      );
    } else if (
      url.pathname ===
      `/api/v1/agents/${ids.agent}/connections/musedam/authorize`
    ) {
      res.end(
        JSON.stringify({
          authorization_url: `${origin}/api/agent-connectors/oauth/start?ticket=one-time`,
          expires_at: "2026-09-16T00:10:00Z",
        }),
      );
    } else if (url.pathname === "/api/v1/agents") {
      res.end(
        JSON.stringify({
          items: url.searchParams.has("cursor")
            ? [
                {
                  id: ids.agent,
                  object: "agent",
                  name: "Test Agent",
                  environment: "production",
                  description: null,
                },
              ]
            : [],
          next_cursor: url.searchParams.has("cursor") ? null : "agent-page-2",
        }),
      );
    } else if (url.pathname === "/api/v1/sessions" && req.method === "GET") {
      res.end(
        JSON.stringify({
          items: [
            conversation(url.searchParams.has("cursor") ? ids.older : ids.chat),
          ],
          next_cursor: url.searchParams.has("cursor")
            ? null
            : "opaque+/cursor=",
        }),
      );
    } else if (url.pathname === "/api/v1/files" && req.method === "POST") {
      res.statusCode = 201;
      res.end(JSON.stringify(fileRecord()));
    } else if (url.pathname === `/api/v1/sessions/${ids.chat}/artifacts`) {
      res.end(
        JSON.stringify({
          items: [artifactRecord()],
          next_cursor: url.searchParams.has("cursor") ? null : ids.artifact,
        }),
      );
    } else if (url.pathname === `/api/v1/files/${ids.artifact}/content`) {
      if (contentGone) {
        res.statusCode = 410;
        res.end("{}");
        return;
      }
      res.statusCode = 302;
      res.setHeader(
        "location",
        `${origin}/signed/report.txt?signature=download-capability`,
      );
      res.setHeader("set-cookie", "upstream-private=secret");
      res.end();
    } else if (
      url.pathname === "/api/v1/sessions" &&
      req.method === "POST" &&
      !JSON.parse(raw).input
    ) {
      res.statusCode = 201;
      res.end(JSON.stringify(conversation()));
    } else if (
      req.method === "GET" &&
      [ids.chat, ids.older].some(
        (id) => url.pathname === `/api/v1/sessions/${id}`,
      )
    ) {
      res.end(
        JSON.stringify(
          conversation(url.pathname.endsWith(ids.chat) ? ids.chat : ids.older),
        ),
      );
    } else if (
      (url.pathname === "/api/v1/sessions" || url.pathname.endsWith("/runs")) &&
      req.method === "POST"
    ) {
      calls++;
      res.setHeader("x-gea-agent-session-id", ids.chat);
      if (createFails) {
        res.statusCode = 503;
        res.end("{}");
        return;
      }
      res.setHeader("x-gea-agent-run-id", ids.run);
      res.setHeader("x-vercel-ai-ui-message-stream", "v1");
      res.setHeader("content-type", "text/event-stream");
      res.setHeader("set-cookie", "upstream-private=secret");
      res.end(
        'data: {"type":"start","messageId":"message-1"}\n\ndata: {"type":"finish","finishReason":"stop"}\n\ndata: [DONE]\n\n',
      );
    } else if (req.url?.includes("/messages")) {
      res.end(
        JSON.stringify({
          items: url.searchParams.has("cursor")
            ? [
                {
                  id: "old",
                  role: "user",
                  parts: [{ type: "text", text: "Older message" }],
                },
              ]
            : failedRun
              ? [
                  {
                    id: "empty-assistant",
                    role: "assistant",
                    parts: [],
                    metadata: { finishReason: "error" },
                  },
                ]
              : [
                  {
                    id: "m1",
                    role: "assistant",
                    parts: [{ type: "text", text: "Persisted reply" }],
                  },
                ],
          next_cursor:
            failedRun || url.searchParams.has("cursor")
              ? null
              : "messages+/cursor=",
        }),
      );
    } else if (req.url?.endsWith("/cancel") && req.method === "POST") {
      // The public GEA HTTP boundary parses POST bodies as JSON, even for cancel.
      try {
        JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            code: "BAD_REQUEST",
            data: { reason: "invalid_json" },
          }),
        );
        return;
      }
      runStopped = true;
      res.end(JSON.stringify({ status: "abort_requested" }));
    } else if (req.url?.endsWith("/stream")) {
      res.statusCode = 204;
      res.setHeader("x-gea-agent-run-id", ids.run);
      res.setHeader("x-gea-agent-session-id", ids.chat);
      res.end();
    } else if (req.url?.includes("/runs/")) {
      res.end(
        JSON.stringify({
          id: ids.run,
          session_id: ids.chat,
          status: runStopped ? "aborted" : failedRun ? "error" : "finished",
        }),
      );
    } else {
      res.statusCode = 404;
      res.end("{}");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No HTTP test port");
  origin = `http://127.0.0.1:${address.port}`;
  app = Object.fromEntries(
    [
      "login",
      "callback",
      "session",
      "logout",
      "conversations",
      "createConversation",
      "uploadFile",
      "artifacts",
      "downloadFile",
      "run",
      "history",
      "stream",
      "cancel",
      "connections",
      "authorizeConnection",
    ].map((name) => [name, (request: Request) => runtime.fetch(request)]),
  ) as typeof app;
});
beforeEach(async () => {
  runtime = await createTestRuntime({
    APP_ORIGIN: "http://localhost:4000",
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    OAUTH_ISSUER_URL: origin,
    OAUTH_CLIENT_ID: "test-client",
    OAUTH_CLIENT_SECRET: "test-secret",
    AGENT_ENVIRONMENT: "production",
  });
  exchanges = [];
  refreshes = [];
  revoked = [];
  calls = 0;
  denied = false;
  musedamConnected = true;
  connectionStatus = undefined;
  connectionOwner = "user";
  hasConnector = true;
  connectionsFail = false;
  connectionBearers.length = 0;
  providerUser = "initial";
  onRefresh = undefined;
  createFails = false;
  contentGone = false;
  apiRequests.length = 0;
  failedRun = false;
  runStopped = false;
  disabledAccessTokens.clear();
  revokeFails = false;
  refreshFails = false;
});
afterEach(async () => {
  await runtime?.dispose();
});
afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
});
describe("GEA OAuth HTTP application", () => {
  it.skipIf(!process.env.GEA_TEST_WORKER_DIR)(
    "serves the app and protects the embedded Agent in one Worker",
    async () => {
      const page = await runtime.fetch(new Request("http://localhost:4000/"));
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("OpenGEA");
      const invocation = await runtime.fetch(
        new Request("http://localhost:4000/gea/agents/musedam-chat/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message: "hello",
            chatId: "unauthorized-test",
          }),
        }),
      );
      expect(invocation.status).toBe(401);
    },
  );

  it("requires the current user's MuseDAM connection before starting a Run", async () => {
    const loggedIn = await signIn();
    musedamConnected = false;
    const response = await app.run(
      request("/api/chat", loggedIn, {
        agentId: ids.agent,
        message: "Search my assets",
      }),
    );
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("connection_required");
    expect(apiRequests.some((entry) => entry.method === "POST")).toBe(false);
  });
  it("checks user readiness and starts MuseDAM authorization before any conversation exists", async () => {
    const loggedIn = await signIn();
    musedamConnected = false;
    const readiness = await app.connections(
      request(`/api/connections?agentId=${ids.agent}`, loggedIn),
    );
    expect(readiness.status).toBe(200);
    const data = await readiness.json();
    expect(data.ready).toBe(false);
    expect(data.items[0].status).toBe("authorization_required");
    expect(JSON.stringify(data)).not.toContain("never-expose");
    expect(connectionBearers).toEqual(["Bearer access-initial"]);
    const response = await app.authorizeConnection(
      request(
        `/api/connections/authorize?agentId=${ids.agent}&key=musedam`,
        loggedIn,
        {},
      ),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `${origin}/api/agent-connectors/oauth/start?ticket=one-time`,
    );
    expect(apiRequests.filter((r) => r.method === "POST")).toEqual([
      {
        method: "POST",
        path: `/api/v1/agents/${ids.agent}/connections/musedam/authorize?environment=production`,
        body: {},
      },
    ]);
    musedamConnected = true;
    expect(
      (
        await (
          await app.connections(
            request(`/api/connections?agentId=${ids.agent}`, loggedIn),
          )
        ).json()
      ).ready,
    ).toBe(true);
    const run = await app.run(
      request("/api/chat", loggedIn, {
        agentId: ids.agent,
        message: "Find assets",
      }),
    );
    expect(run.status).toBe(200);
    await run.text();
    expect(calls).toBe(1);
  });
  it("blocks Runs for missing declarations, revoked credentials and administrator setup", async () => {
    const loggedIn = await signIn();
    for (const status of [
      "reauthorization_required",
      "administrator_configuration_required",
    ]) {
      connectionStatus = status;
      const result = await app.run(
        request("/api/chat", loggedIn, { chatId: ids.chat, message: "Hello" }),
      );
      expect(result.status).toBe(409);
      expect((await result.json()).code).toBe("connection_required");
    }
    connectionStatus = undefined;
    hasConnector = false;
    expect(
      (
        await (
          await app.connections(
            request(`/api/connections?agentId=${ids.agent}`, loggedIn),
          )
        ).json()
      ).ready,
    ).toBe(false);
    hasConnector = true;
    connectionOwner = "shared";
    expect(
      (
        await app.authorizeConnection(
          request(
            `/api/connections/authorize?agentId=${ids.agent}&key=musedam`,
            loggedIn,
            {},
          ),
        )
      ).status,
    ).toBe(409);
    expect(calls).toBe(0);
    expect(apiRequests.filter((r) => r.method === "POST")).toEqual([]);
  });
  it("returns connection lookup failures and checks origin and login before authorization", async () => {
    expect(
      (await app.connections(request(`/api/connections?agentId=${ids.agent}`)))
        .status,
    ).toBe(401);
    const loggedIn = await signIn();
    const path = `/api/connections/authorize?agentId=${ids.agent}&key=musedam`;
    const crossOrigin = request(path, loggedIn, {});
    crossOrigin.headers.set("origin", "https://attacker.example");
    expect((await app.authorizeConnection(crossOrigin)).status).toBe(403);
    expect(apiRequests).toEqual([]);
    connectionsFail = true;
    expect(
      (
        await app.connections(
          request(`/api/connections?agentId=${ids.agent}`, loggedIn),
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await app.run(
          request("/api/chat", loggedIn, {
            agentId: ids.agent,
            message: "Hello",
          }),
        )
      ).status,
    ).toBe(503);
    expect(calls).toBe(0);
  });
  it("keeps app sessions and remembered Runs across restart, scoped to environment and user", async () => {
    const loggedIn = await signIn();
    const run = await app.run(
      request("/api/chat", loggedIn, { agentId: ids.agent, message: "Hello" }),
    );
    await run.text();
    await runtime.restart();
    expect((await app.session(request("/api/session", loggedIn))).status).toBe(
      200,
    );
    expect(
      (
        await (
          await app.history(request(`/api/chat?chatId=${ids.chat}`, loggedIn))
        ).json()
      ).run.id,
    ).toBe(ids.run);
    await runtime.restart({ AGENT_ENVIRONMENT: "preview" });
    expect((await app.session(request("/api/session", loggedIn))).status).toBe(
      401,
    );
    await runtime.restart({ AGENT_ENVIRONMENT: "production" });
    expect((await app.session(request("/api/session", loggedIn))).status).toBe(
      200,
    );
    providerUser = "other";
    const other = await signIn();
    expect(
      (
        await (
          await app.history(request(`/api/chat?chatId=${ids.chat}`, other))
        ).json()
      ).run,
    ).toBeNull();
    await app.connections(
      request(`/api/connections?agentId=${ids.agent}`, other),
    );
    expect(connectionBearers.at(-1)).toBe("Bearer access-other");
  });
  it("serializes logout behind an in-flight refresh and revokes the replacement pair", async () => {
    const loggedIn = await signIn();
    await runtime.inspectSqlite({
      table: "session",
      statement: "UPDATE session SET token_expires_at = 0",
    });
    const refreshing = new Promise<void>((resolve) => {
      onRefresh = resolve;
    });
    const sessionRequest = app.session(request("/api/session", loggedIn));
    await refreshing;
    const logout = await app.logout(request("/auth/logout", loggedIn, {}));
    await sessionRequest;
    expect(logout.status).toBe(303);
    expect(refreshes).toEqual(["refresh-initial"]);
    expect(revoked).toEqual(["refresh-rotated-1"]);
    expect((await app.session(request("/api/session", loggedIn))).status).toBe(
      401,
    );
  });
  it("prepares a Session, uploads exact bytes and references uploaded and generated Files in a Run", async () => {
    const loggedIn = await signIn();
    const prepared = await app.createConversation(
      request("/api/conversations", loggedIn, {
        agentId: ids.agent,
        title: "Files first",
      }),
    );
    expect(prepared.status).toBe(201);
    expect((await prepared.json()).id).toBe(ids.chat);
    expect(calls).toBe(0);
    expect(apiRequests.at(-1)?.body).toEqual({
      agent_id: ids.agent,
      environment: "production",
      title: "Files first",
    });
    const uploaded = await app.uploadFile(uploadRequest(loggedIn));
    expect(uploaded.status).toBe(201);
    expect((await uploaded.json()).id).toBe(ids.file);
    expect(apiRequests.at(-1)).toEqual({
      method: "POST",
      path: "/api/v1/files",
      body: {
        environment: "production",
        filename: "notes.txt",
        media_type: "text/plain",
        bytes: [0, 255, 128, 1],
      },
    });
    expect(calls).toBe(0);
    const response = await app.run(
      request("/api/chat", loggedIn, {
        chatId: ids.chat,
        message: "Read both",
        fileIds: [ids.file, ids.artifact],
      }),
    );
    expect(response.status).toBe(200);
    expect(apiRequests.at(-1)?.body).toEqual({
      input: {
        role: "user",
        parts: [
          { type: "text", text: "Read both" },
          { type: "file", file_id: ids.file },
          { type: "file", file_id: ids.artifact },
        ],
      },
      stream: true,
    });
    expect(calls).toBe(1);
  });
  it("accepts a file-only turn and rejects an empty turn or invalid file reference", async () => {
    const loggedIn = await signIn();
    expect(
      (
        await app.run(
          request("/api/chat", loggedIn, {
            chatId: ids.chat,
            message: "",
            fileIds: [ids.file],
          }),
        )
      ).status,
    ).toBe(200);
    expect(apiRequests.at(-1)?.body).toEqual({
      input: { role: "user", parts: [{ type: "file", file_id: ids.file }] },
      stream: true,
    });
    expect(
      (
        await app.run(
          request("/api/chat", loggedIn, {
            chatId: ids.chat,
            message: "",
            fileIds: [],
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await app.run(
          request("/api/chat", loggedIn, {
            chatId: ids.chat,
            message: "Hi",
            fileIds: ["not-a-file"],
          }),
        )
      ).status,
    ).toBe(400);
    expect(calls).toBe(1);
  });
  it("pages authorized Session artifacts and downloads through the backend without leaking OAuth credentials", async () => {
    const loggedIn = await signIn();
    const first = await app.artifacts(
      request(`/api/artifacts?chatId=${ids.chat}&limit=1`, loggedIn),
    );
    expect(first.status).toBe(200);
    const page = await first.json();
    expect(page.items[0].id).toBe(ids.artifact);
    expect(page.items[0].session_id).toBe(ids.chat);
    const second = await app.artifacts(
      request(
        `/api/artifacts?chatId=${ids.chat}&cursor=${page.next_cursor}&limit=1`,
        loggedIn,
      ),
    );
    expect((await second.json()).next_cursor).toBeNull();
    expect(apiRequests.at(-1)?.path).toBe(
      `/api/v1/sessions/${ids.chat}/artifacts?limit=1&cursor=${ids.artifact}`,
    );
    const download = await app.downloadFile(
      request(`/api/files/content?fileId=${ids.artifact}`, loggedIn),
    );
    expect(download.status).toBe(302);
    expect(download.headers.get("location")).toBe(
      `${origin}/signed/report.txt?signature=download-capability`,
    );
    expect(download.headers.get("set-cookie")).toBeNull();
    expect(download.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify([...download.headers])).not.toMatch(
      /access-initial|refresh-initial/,
    );
    contentGone = true;
    const removed = await app.downloadFile(
      request(`/api/files/content?fileId=${ids.artifact}`, loggedIn),
    );
    expect(removed.status).toBe(410);
    expect((await removed.json()).message).toContain("deleted");
    denied = true;
    expect(
      (
        await app.artifacts(
          request(`/api/artifacts?chatId=${ids.chat}`, loggedIn),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await app.downloadFile(
          request(`/api/files/content?fileId=${ids.artifact}`, loggedIn),
        )
      ).status,
    ).toBe(404);
    expect((await app.uploadFile(uploadRequest(loggedIn))).status).toBe(404);
  });
  it("rejects anonymous, cross-origin, malformed and oversized uploads before a file write", async () => {
    const loggedIn = await signIn();
    expect((await app.uploadFile(uploadRequest(""))).status).toBe(401);
    const crossOrigin = uploadRequest(loggedIn);
    crossOrigin.headers.set("origin", "https://attacker.example");
    expect((await app.uploadFile(crossOrigin)).status).toBe(403);
    expect(
      (
        await app.uploadFile(
          request(`/api/files?chatId=${ids.chat}`, loggedIn, {}),
        )
      ).status,
    ).toBe(415);
    const tooLarge = new File(
      [new Uint8Array(4 * 1024 * 1024 + 1)],
      "large.bin",
    );
    expect(
      (await app.uploadFile(uploadRequest(loggedIn, tooLarge))).status,
    ).toBe(413);
    expect(apiRequests.some((entry) => entry.path === "/api/v1/files")).toBe(
      false,
    );
  });
  it("binds a one-time code to the browser and S256 verifier; ignores forged organization metadata", async () => {
    const flow = await begin();
    expect(flow.url.origin).toBe(origin);
    expect(flow.url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(flow.url.searchParams.has("organization_id")).toBe(false);
    const response = await app.callback(
      request(
        `/auth/callback?state=${flow.url.searchParams.get("state")}&code=good&organization_id=forged`,
        flow.cookie,
      ),
    );
    expect(exchanges).toHaveLength(1);
    expect(
      createHash("sha256")
        .update(exchanges[0]!.get("code_verifier")!)
        .digest("base64url"),
    ).toBe(flow.url.searchParams.get("code_challenge"));
    const browserSession = cookie(response);
    expect(browserSession).not.toMatch(
      /access-|refresh-|test-secret|pairwise-user/,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    const dashboard = await app.session(
      request("/api/session", browserSession),
    );
    const data = await dashboard.json();
    expect(data.organization.name).toBe("Verified organization");
    expect(data.user.name).toBe("Test user");
    expect(JSON.stringify(data)).not.toMatch(
      /access_token|refresh_token|access-initial|refresh-initial/,
    );
    const replay = await app.callback(
      request(
        `/auth/callback?state=${flow.url.searchParams.get("state")}&code=good`,
        flow.cookie,
      ),
    );
    expect(replay.headers.get("location")).toContain("invalid_state");
    expect(exchanges).toHaveLength(1);
    const rows = await runtime.inspectSqlite();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toMatch(
      /access-initial|refresh-initial|pairwise-user/,
    );
  });
  it("rejects missing, mismatched, duplicate, expired and cross-browser state before exchanging", async () => {
    const flow = await begin();
    const state = flow.url.searchParams.get("state");
    for (const [search, cookies] of [
      ["code=good", flow.cookie],
      [`state=wrong&code=good`, flow.cookie],
      [`state=${state}&state=${state}&code=good`, flow.cookie],
      [`state=${state}&code=good`, ""],
    ]) {
      const response = await app.callback(
        request(`/auth/callback?${search}`, cookies),
      );
      expect(response.headers.get("location")).toContain("invalid_state");
    }
    await runtime.inspectSqlite({
      table: "flow",
      statement: "UPDATE flow SET expires_at = 0",
    });
    await app.callback(
      request(`/auth/callback?state=${state}&code=good`, flow.cookie),
    );
    expect(exchanges).toHaveLength(0);
  });
  it("handles cancellation without exchanging or destroying an existing session", async () => {
    const loggedIn = await signIn();
    const flow = await begin();
    const response = await app.callback(
      request(
        `/auth/callback?state=${flow.url.searchParams.get("state")}&error=access_denied&error_description=untrusted`,
        `${loggedIn}; ${flow.cookie}`,
      ),
    );
    expect(response.headers.get("location")).toContain("access_denied");
    expect(exchanges).toHaveLength(1);
    expect((await app.session(request("/api/session", loggedIn))).status).toBe(
      200,
    );
  });
  it("serializes concurrent refreshes across requests and persists the replacement tokens", async () => {
    const loggedIn = await signIn();
    await runtime.inspectSqlite({
      table: "session",
      statement: "UPDATE session SET token_expires_at = 0",
    });
    const responses = await Promise.all(
      Array.from({ length: 6 }, () =>
        app.session(request("/api/session", loggedIn)),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([
      200, 200, 200, 200, 200, 200,
    ]);
    expect(refreshes).toEqual(["refresh-initial"]);
    await runtime.inspectSqlite({
      table: "session",
      statement: "UPDATE session SET token_expires_at = 0",
    });
    await app.session(request("/api/session", loggedIn));
    expect(refreshes).toEqual(["refresh-initial", "refresh-rotated-1"]);
  });
  it("does not retry an ambiguous token refresh", async () => {
    const loggedIn = await signIn();
    await runtime.inspectSqlite({
      table: "session",
      statement: "UPDATE session SET token_expires_at = 0",
    });
    refreshFails = true;
    expect((await app.session(request("/api/session", loggedIn))).status).toBe(
      401,
    );
    expect((await app.session(request("/api/session", loggedIn))).status).toBe(
      401,
    );
    expect(refreshes).toHaveLength(1);
  });
  it("rejects cross-origin mutations and anonymous chats before upstream calls", async () => {
    const response = await app.login(
      new Request("http://localhost:4000/auth/login", {
        method: "POST",
        headers: { origin: "https://attacker.example" },
      }),
    );
    expect(response.status).toBe(403);
    expect(
      (
        await app.run(
          request("/api/chat", "", { agentId: ids.agent, message: "hi" }),
        )
      ).status,
    ).toBe(401);
    expect(calls).toBe(0);
  });
  it("relays chat streams without credentials and restores persisted history", async () => {
    const loggedIn = await signIn();
    const response = await app.run(
      request("/api/chat", loggedIn, { agentId: ids.agent, message: "Hello" }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("x-gea-agent-session-id")).toBe(ids.chat);
    expect(await response.text()).toContain("[DONE]");
    const result = await app.history(
      request(`/api/chat?chatId=${ids.chat}`, loggedIn),
    );
    expect((await result.json()).messages[0].parts[0].text).toBe(
      "Persisted reply",
    );
    const anotherSession = await signIn();
    // A new login by the same GEA user can recover their authorized history.
    expect(
      (
        await app.history(
          request(`/api/chat?chatId=${ids.chat}`, anotherSession),
        )
      ).status,
    ).toBe(200);
    const recovered = await app.session(request("/api/session", loggedIn));
    expect((await recovered.json()).agents).toEqual([
      {
        id: ids.agent,
        name: "Test Agent",
        environment: "production",
        description: null,
      },
    ]);
  });
  it("discovers across sparse pages and pages conversations and older messages after a new login", async () => {
    const loggedIn = await signIn();
    expect(
      (await (await app.session(request("/api/session", loggedIn))).json())
        .agents[0].id,
    ).toBe(ids.agent);
    const first = await (
      await app.conversations(request("/api/conversations", loggedIn))
    ).json();
    expect(first.items[0].title).toBe("Hello");
    const second = await (
      await app.conversations(
        request(
          `/api/conversations?cursor=${encodeURIComponent(first.next_cursor)}`,
          loggedIn,
        ),
      )
    ).json();
    expect(second.items[0].id).toBe(ids.older);
    expect(second.next_cursor).toBeNull();
    const history = await (
      await app.history(request(`/api/chat?chatId=${ids.chat}`, loggedIn))
    ).json();
    const older = await (
      await app.history(
        request(
          `/api/chat?chatId=${ids.chat}&cursor=${encodeURIComponent(history.nextCursor)}`,
          loggedIn,
        ),
      )
    ).json();
    expect(older.messages[0].parts[0].text).toBe("Older message");
    expect(older.nextCursor).toBeNull();
    const continued = await app.run(
      request("/api/chat", loggedIn, {
        chatId: ids.older,
        message: "Continue",
      }),
    );
    // This fake provider intentionally returns a different identity; the app fails closed.
    expect(continued.status).toBe(502);
    expect(
      apiRequests.find((r) => r.path === `/api/v1/sessions/${ids.older}/runs`)
        ?.body,
    ).toEqual({
      input: "Continue",
      stream: true,
    });
  });
  it("forwards bounded page sizes and rejects invalid sizes", async () => {
    const loggedIn = await signIn();
    expect(
      (await app.conversations(request("/api/conversations?limit=1", loggedIn)))
        .status,
    ).toBe(200);
    expect(
      new URL(apiRequests.at(-1)!.path, "http://gea").searchParams.get("limit"),
    ).toBe("1");
    expect(
      (
        await app.history(
          request(`/api/chat?chatId=${ids.chat}&limit=1`, loggedIn),
        )
      ).status,
    ).toBe(200);
    expect(apiRequests.some((r) => r.path.includes("/messages?limit=1"))).toBe(
      true,
    );
    expect(
      (await app.conversations(request("/api/conversations?limit=0", loggedIn)))
        .status,
    ).toBe(400);
    expect(
      (
        await app.history(
          request(`/api/chat?chatId=${ids.chat}&limit=101`, loggedIn),
        )
      ).status,
    ).toBe(400);
  });
  it("keeps the created session identity on admission failure without retrying the turn", async () => {
    const loggedIn = await signIn();
    createFails = true;
    const response = await app.run(
      request("/api/chat", loggedIn, { agentId: ids.agent, message: "Hello" }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("x-gea-agent-session-id")).toBe(ids.chat);
    expect(apiRequests.filter((r) => r.method === "POST")).toHaveLength(1);
  });
  it("checks GEA authorization on history, continuation and run operations", async () => {
    const loggedIn = await signIn();
    await app.run(
      request("/api/chat", loggedIn, { agentId: ids.agent, message: "Hello" }),
    );
    denied = true;
    for (const response of [
      await app.history(request(`/api/chat?chatId=${ids.chat}`, loggedIn)),
      await app.stream(
        request(`/api/chat/stream?chatId=${ids.chat}`, loggedIn),
      ),
      await app.cancel(
        request("/api/chat/cancel", loggedIn, { chatId: ids.chat }),
      ),
    ]) {
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("private upstream detail");
    }
  });
  it("cancels the remembered run through GEA's JSON endpoint and restores its terminal status", async () => {
    const loggedIn = await signIn();
    await app.run(
      request("/api/chat", loggedIn, { agentId: ids.agent, message: "Hello" }),
    );
    const anotherSession = await signIn();
    expect(
      (await app.cancel(request("/api/chat/cancel", anotherSession, {})))
        .status,
    ).toBe(400);
    const response = await app.cancel(
      request("/api/chat/cancel", loggedIn, { chatId: ids.chat }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "abort_requested" });
    const history = await app.history(
      request(`/api/chat?chatId=${ids.chat}`, loggedIn),
    );
    expect((await history.json()).run.status).toBe("aborted");
  });
  it("reattaches the recorded Run after signing in again", async () => {
    const loggedIn = await signIn();
    expect(
      (
        await app.run(
          request("/api/chat", loggedIn, {
            agentId: ids.agent,
            message: "Hello",
          }),
        )
      ).status,
    ).toBe(200);
    const newLogin = await signIn();
    const response = await app.stream(
      request(`/api/chat/stream?chatId=${ids.chat}`, newLogin),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get("x-gea-agent-run-id")).toBe(ids.run);
    expect(apiRequests.at(-1)?.path).toBe(`/api/v1/runs/${ids.run}/stream`);
  });
  it("revokes rotated credentials on logout and makes session reuse fail", async () => {
    const loggedIn = await signIn();
    await runtime.inspectSqlite({
      table: "session",
      statement: "UPDATE session SET token_expires_at = 0",
    });
    await app.session(request("/api/session", loggedIn));
    const response = await app.logout(request("/auth/logout", loggedIn, {}));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:4000/");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(revoked).toContain("refresh-rotated-1");
    expect(
      (
        await fetch(`${origin}/api/auth/oauth2/userinfo`, {
          headers: { authorization: "Bearer access-rotated-1" },
        })
      ).status,
    ).toBe(401);
    expect((await app.session(request("/api/session", loggedIn))).status).toBe(
      401,
    );
  });
  it("restores an execution failure with GEA's empty assistant placeholder", async () => {
    const loggedIn = await signIn();
    await app.run(
      request("/api/chat", loggedIn, { agentId: ids.agent, message: "Hello" }),
    );
    failedRun = true;
    const response = await app.history(
      request(`/api/chat?chatId=${ids.chat}`, loggedIn),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.run.status).toBe("error");
    expect(body.messages).toEqual([
      {
        id: "empty-assistant",
        role: "assistant",
        parts: [],
        metadata: { finishReason: "error" },
      },
    ]);
  });
  it("keeps failed revocation retryable while blocking API use", async () => {
    const loggedIn = await signIn();
    revokeFails = true;
    const response = await app.logout(request("/auth/logout", loggedIn, {}));
    expect(response.headers.get("location")).toContain("revoke_failed");
    expect(
      (
        await app.run(
          request("/api/chat", loggedIn, { agentId: ids.agent, message: "no" }),
        )
      ).status,
    ).toBe(401);
    revokeFails = false;
    expect(
      (await app.logout(request("/auth/logout", loggedIn, {}))).headers.get(
        "location",
      ),
    ).toBe("http://localhost:4000/");
    expect(revoked).toContain("refresh-initial");
  });
});
