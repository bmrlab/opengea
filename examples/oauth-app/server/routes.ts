import { z } from "zod";
import { validateUIMessages } from "ai";
import { getEnv, getAppEnv } from "./env";
import { maxMessageFiles, maxUploadBytes } from "../lib/files";
import {
  authorizationUrl,
  agentFetch,
  HttpError,
  tokenRequest,
  userInfo,
} from "./gea";
import { hash, randomSecret } from "./store";
import {
  cookieValue,
  flowCookie,
  loadSession,
  loadAgentSession,
  saveSession,
  sessionCookie,
  setCookie,
  loginFlow,
  oauthSession,
  conversationRuns,
} from "./session";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
const redirect = (code?: string) =>
  new Response(null, {
    status: 303,
    headers: {
      location: `${getAppEnv().APP_ORIGIN}/${code ? `?notice=${encodeURIComponent(code)}` : ""}`,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== getAppEnv().APP_ORIGIN)
    throw new HttpError(403, "invalid_origin", "Invalid request origin.");
}
// App HTTP edges return bounded, app-authored errors, never raw GEA bodies or tokens.
function failure(error: unknown) {
  return error instanceof HttpError
    ? json({ code: error.code, message: error.message }, error.status)
    : json(
        {
          code: "request_failed",
          message:
            "The request could not be completed. Retry or check the server configuration.",
        },
        502,
      );
}
async function inputJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "invalid_input", "Send a JSON request.");
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 32768)
    throw new HttpError(413, "invalid_input", "The message is too long.");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "invalid_input", "Invalid JSON request.");
  }
}
export async function login(request: Request) {
  try {
    sameOrigin(request);
    const proof = randomSecret(),
      state = randomSecret(),
      verifier = randomSecret();
    const key = await hash(proof);
    const previous = cookieValue(request, flowCookie);
    if (previous) await loginFlow(await hash(previous)).remove();
    await loginFlow(key).create(
      await hash(state),
      verifier,
      getEnv().TOKEN_ENCRYPTION_KEY,
    );
    const response = new Response(null, {
      status: 303,
      headers: {
        location: authorizationUrl(state, await hash(verifier)),
        "cache-control": "no-store",
      },
    });
    setCookie(response.headers, flowCookie, proof, 300);
    return response;
  } catch (error) {
    return failure(error);
  }
}
export async function callback(request: Request) {
  let response: Response;
  try {
    const params = new URL(request.url).searchParams;
    const proof = cookieValue(request, flowCookie),
      state = params.get("state");
    if (
      !proof ||
      !state ||
      ["state", "code", "error", "error_description"].some(
        (k) => params.getAll(k).length > 1,
      )
    )
      return redirect("invalid_state");
    const key = await hash(proof);
    const flow = await loginFlow(key).consume(
      await hash(state),
      getEnv().TOKEN_ENCRYPTION_KEY,
    );
    if (!flow) return redirect("invalid_state");
    if (params.has("error"))
      response = redirect(
        params.get("error") === "access_denied"
          ? "access_denied"
          : "oauth_failed",
      );
    else {
      const code = params.get("code");
      if (!code || code.length > 8192) return redirect("oauth_failed");
      const { verifier } = flow;
      const token = await tokenRequest(
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: `${getAppEnv().APP_ORIGIN}/auth/callback`,
        }),
      );
      const session = randomSecret();
      await saveSession(await hash(session), token);
      response = redirect();
      setCookie(response.headers, sessionCookie, session, 7 * 86400);
    }
  } catch {
    response = redirect("oauth_failed");
  }
  setCookie(response.headers, flowCookie, "", 0);
  return response;
}
export async function session(request: Request) {
  try {
    const app = getAppEnv();
    if (app.AGENT_ENVIRONMENT === "local") {
      await loadAgentSession(request);
      return json({
        user: { sub: "local-user", name: "Local developer" },
        organization: { id: "local", name: "Local project", slug: "local" },
        scopes: [],
        expiresAt: null,
        agents: await discoverAgents(undefined),
        environment: "local",
      });
    }
    const current = await loadSession(request);
    const user = await userInfo(current.token.access_token);
    if (user.sub !== current.user.sub)
      throw new HttpError(
        401,
        "sign_in_required",
        "The GEA identity changed. Sign in again.",
      );
    const env = getEnv();
    return json({
      user,
      organization: current.token.organization,
      scopes: current.token.scope.split(/\s+/),
      expiresAt: new Date(current.expiresAt).toISOString(),
      agents: await discoverAgents(current.token.access_token),
      environment: env.AGENT_ENVIRONMENT,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function logout(request: Request) {
  try {
    sameOrigin(request);
    const cookie = cookieValue(request, sessionCookie);
    const succeeded =
      !cookie || (await oauthSession(await hash(cookie)).revoke(getEnv()));
    const response = redirect(succeeded ? undefined : "revoke_failed");
    if (succeeded) setCookie(response.headers, sessionCookie, "", 0);
    return response;
  } catch (error) {
    return failure(error);
  }
}

// These are HTTP response parsers, not an SDK dependency. GEA owns authorization.
const agentOutput = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  environment: z.enum(["local", "preview", "production"]),
});
const conversationOutput = z.object({
  id: z.uuid(),
  agent_id: z.uuid(),
  environment: z.enum(["local", "preview", "production"]),
  title: z.string().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
const runOutput = z.object({
  id: z.uuid(),
  session_id: z.uuid(),
  status: z.string(),
});
const cursorOutput = z.string().min(1).nullable();
const pageQuery = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const runInput = z
  .strictObject({
    chatId: z.uuid().optional(),
    agentId: z.uuid().optional(),
    message: z.string().trim().max(8000),
    fileIds: z.array(z.uuid()).max(maxMessageFiles).default([]),
  })
  .refine((v) => Boolean(v.chatId) !== Boolean(v.agentId))
  .refine((v) => Boolean(v.message) || v.fileIds.length > 0);
const fileOutput = z.object({
  id: z.uuid(),
  filename: z.string(),
  media_type: z.string(),
  size: z.number().int().nonnegative(),
  title: z.string(),
  created_at: z.iso.datetime(),
  deleted_at: z.iso.datetime().nullable(),
});
const artifactOutput = fileOutput.extend({
  session_id: z.uuid().nullable(),
  run_id: z.uuid().nullable(),
});
export type FileView = z.infer<typeof fileOutput>;
export type ArtifactView = z.infer<typeof artifactOutput>;
const emptyAssistant = z.object({
  id: z.string().min(1),
  role: z.literal("assistant"),
  parts: z.tuple([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type AgentView = z.infer<typeof agentOutput>;
export type ConversationSummary = z.infer<typeof conversationOutput>;

function relay(upstream: Response) {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const name of [
    "content-type",
    "x-vercel-ai-ui-message-stream",
    "x-gea-agent-session-id",
    "x-gea-agent-run-id",
    "x-gea-request-id",
    "retry-after",
  ]) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}
async function assertUpstream(response: Response) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new HttpError(
      [401, 403, 404, 409, 410, 413, 429, 503].includes(response.status)
        ? response.status
        : 502,
      "agent_failed",
      response.status === 403
        ? "GEA has not granted this user and application access to the Agent. Check the application's environment setup."
        : response.status === 404
          ? "This conversation, file or Agent is unavailable to your GEA account."
          : response.status === 410
            ? "This file's content has been deleted."
            : response.status === 413
              ? "The file exceeds the GEA server's upload limit."
              : response.status === 409
                ? "This conversation already has an active run. Restore it before sending another message."
                : "The Agent request failed. Refresh history to check whether a conversation was created before sending again.",
    );
  }
}
async function discoverAgents(token: string | undefined) {
  const agents: AgentView[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({
      environment: getAppEnv().AGENT_ENVIRONMENT,
      limit: "100",
    });
    if (cursor) query.set("cursor", cursor);
    const response = await agentFetch(`/agents?${query}`, token);
    await assertUpstream(response);
    const page = z
      .object({ items: z.array(agentOutput), next_cursor: cursorOutput })
      .parse(await response.json());
    agents.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor !== null); // Permission filtering can return an empty page with a cursor.
  return agents;
}
export async function conversations(request: Request) {
  try {
    const query = pageQuery.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!query.success)
      throw new HttpError(400, "invalid_input", "Invalid history cursor.");
    const current = await loadAgentSession(request);
    const params = new URLSearchParams({
      environment: getAppEnv().AGENT_ENVIRONMENT,
      limit: String(query.data.limit),
    });
    if (query.data.cursor) params.set("cursor", query.data.cursor);
    const response = await agentFetch(
      `/sessions?${params}`,
      current.accessToken,
    );
    await assertUpstream(response);
    return json(
      z
        .object({
          items: z.array(conversationOutput),
          next_cursor: cursorOutput,
        })
        .parse(await response.json()),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function createConversation(request: Request) {
  try {
    sameOrigin(request);
    const parsed = z
      .strictObject({
        agentId: z.uuid(),
        title: z.string().trim().min(1).max(80),
      })
      .safeParse(await inputJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "invalid_input",
        "Choose an Agent and a conversation title.",
      );
    const current = await loadAgentSession(request);
    const response = await agentFetch("/sessions", current.accessToken, {
      method: "POST",
      body: JSON.stringify({
        agent_id: parsed.data.agentId,
        environment: getAppEnv().AGENT_ENVIRONMENT,
        title: parsed.data.title,
      }),
    });
    await assertUpstream(response);
    const conversation = conversationOutput.parse(await response.json());
    if (
      conversation.agent_id !== parsed.data.agentId ||
      conversation.environment !== getAppEnv().AGENT_ENVIRONMENT
    )
      throw new HttpError(
        502,
        "invalid_agent_response",
        "Unexpected conversation identity. Refresh history before trying again.",
      );
    return json(conversation, 201);
  } catch (error) {
    return failure(error);
  }
}
export async function uploadFile(request: Request) {
  try {
    sameOrigin(request);
    const chatId = z
      .uuid()
      .safeParse(new URL(request.url).searchParams.get("chatId"));
    if (!chatId.success)
      throw new HttpError(
        400,
        "invalid_input",
        "Choose a conversation before uploading.",
      );
    const current = await loadAgentSession(request);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new HttpError(
        415,
        "invalid_input",
        "Send a multipart file upload.",
      );
    if (
      Number(request.headers.get("content-length") ?? 0) >
      maxUploadBytes + 64 * 1024
    )
      throw new HttpError(
        413,
        "file_too_large",
        "Choose a file no larger than 4 MiB.",
      );
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || form.getAll("file").length !== 1)
      throw new HttpError(400, "invalid_input", "Upload one file at a time.");
    if (file.size > maxUploadBytes)
      throw new HttpError(
        413,
        "file_too_large",
        "Choose a file no larger than 4 MiB.",
      );
    await authorizedConversation(chatId.data, current.accessToken);
    const upstreamForm = new FormData();
    upstreamForm.set("file", file);
    upstreamForm.set("environment", getAppEnv().AGENT_ENVIRONMENT);
    const response = await agentFetch("/files", current.accessToken, {
      method: "POST",
      body: upstreamForm,
    });
    await assertUpstream(response);
    return json(fileOutput.parse(await response.json()), 201);
  } catch (error) {
    return failure(error);
  }
}
export async function artifacts(request: Request) {
  try {
    const query = pageQuery
      .extend({ chatId: z.uuid() })
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success)
      throw new HttpError(
        400,
        "invalid_input",
        "Invalid conversation or artifact cursor.",
      );
    const current = await loadAgentSession(request);
    await authorizedConversation(query.data.chatId, current.accessToken);
    const params = new URLSearchParams({ limit: String(query.data.limit) });
    if (query.data.cursor) params.set("cursor", query.data.cursor);
    const response = await agentFetch(
      `/sessions/${query.data.chatId}/artifacts?${params}`,
      current.accessToken,
    );
    await assertUpstream(response);
    return json(
      z
        .object({ items: z.array(artifactOutput), next_cursor: cursorOutput })
        .parse(await response.json()),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function downloadFile(request: Request) {
  try {
    const fileId = z
      .uuid()
      .safeParse(new URL(request.url).searchParams.get("fileId"));
    if (!fileId.success)
      throw new HttpError(400, "invalid_input", "Invalid file reference.");
    const current = await loadAgentSession(request);
    // Never forward the OAuth token to the object store. Only the signed URL is redirected.
    const response = await agentFetch(
      `/files/${fileId.data}/content`,
      current.accessToken,
      {
        redirect: "manual",
      },
    );
    if (response.status === 302) {
      const location = z.url().parse(response.headers.get("location"));
      if (!["http:", "https:"].includes(new URL(location).protocol))
        throw new HttpError(
          502,
          "invalid_file_response",
          "Invalid file download URL.",
        );
      await response.body?.cancel();
      return new Response(null, {
        status: 302,
        headers: {
          location,
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
      });
    }
    await assertUpstream(response);
    const headers = new Headers({
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-disposition":
        response.headers.get("content-disposition") ?? "attachment",
    });
    headers.set(
      "content-type",
      response.headers.get("content-type") ?? "application/octet-stream",
    );
    return new Response(response.body, { headers });
  } catch (error) {
    return failure(error);
  }
}
async function authorizedConversation(
  chatId: string,
  token: string | undefined,
) {
  const response = await agentFetch(`/sessions/${chatId}`, token);
  await assertUpstream(response);
  const conversation = conversationOutput.parse(await response.json());
  if (
    conversation.id !== chatId ||
    conversation.environment !== getAppEnv().AGENT_ENVIRONMENT
  )
    throw new HttpError(404, "chat_unavailable", "Conversation unavailable.");
  return conversation;
}
// GEA has no list-Runs/latest-Run field. Retain only the returned Run reference;
// messages and session ownership are always read from GEA, including after a new login.
async function rememberedRun(
  chatId: string,
  current: Awaited<ReturnType<typeof loadAgentSession>>,
) {
  const runId = await conversationRuns(current).getRun(chatId);
  if (!runId) return null;
  const response = await agentFetch(`/runs/${runId}`, current.accessToken);
  await assertUpstream(response);
  const run = runOutput.parse(await response.json());
  if (run.session_id !== chatId || run.id !== runId)
    throw new HttpError(
      502,
      "invalid_agent_response",
      "Unexpected execution identity.",
    );
  return run;
}
export async function run(request: Request) {
  let createdId: string | null = null;
  try {
    sameOrigin(request);
    const parsed = runInput.safeParse(await inputJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "invalid_input",
        "Choose an Agent or conversation, then send a message of at most 8,000 characters or up to 10 files.",
      );
    const current = await loadAgentSession(request);
    const { chatId, agentId, message, fileIds } = parsed.data;
    const input = fileIds.length
      ? {
          role: "user",
          parts: [
            ...(message ? [{ type: "text", text: message }] : []),
            ...fileIds.map((id) => ({ type: "file", file_id: id })),
          ],
        }
      : message;
    const selectedAgent = chatId
      ? (await authorizedConversation(chatId, current.accessToken)).agent_id
      : agentId!;
    const readiness = await readConnections(selectedAgent, current.accessToken);
    if (!readiness.ready)
      throw new HttpError(
        409,
        "connection_required",
        "Connect MuseDAM before sending a message. Check Connections on this page.",
      );
    // Exactly one write. Never replay a user turn after an ambiguous network failure.
    const upstream = await agentFetch(
      chatId ? `/sessions/${chatId}/runs` : "/sessions",
      current.accessToken,
      {
        method: "POST",
        body: JSON.stringify(
          chatId
            ? { input, stream: true }
            : {
                agent_id: agentId,
                environment: getAppEnv().AGENT_ENVIRONMENT,
                title: message.slice(0, 80) || "File conversation",
                input,
                stream: true,
              },
        ),
        signal: request.signal,
      },
    );
    const sessionId = upstream.headers.get("x-gea-agent-session-id"),
      runId = upstream.headers.get("x-gea-agent-run-id");
    if (
      (sessionId &&
        (!z.uuid().safeParse(sessionId).success ||
          (chatId && chatId !== sessionId))) ||
      (runId && (!sessionId || !z.uuid().safeParse(runId).success))
    ) {
      await upstream.body?.cancel();
      throw new HttpError(
        502,
        "invalid_agent_response",
        "Unexpected conversation identity.",
      );
    }
    createdId = sessionId;
    if (sessionId && runId)
      await conversationRuns(current).remember(sessionId, runId);
    await assertUpstream(upstream);
    if (!sessionId || !runId) {
      await upstream.body?.cancel();
      throw new HttpError(
        502,
        "invalid_agent_response",
        "Missing conversation identity. Refresh history before trying again.",
      );
    }
    return relay(upstream);
  } catch (error) {
    const response = failure(error);
    // Create-and-invoke can create a session even if execution admission fails.
    if (createdId) response.headers.set("x-gea-agent-session-id", createdId);
    return response;
  }
}
export async function history(request: Request) {
  try {
    const query = pageQuery
      .extend({ chatId: z.uuid() })
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success)
      throw new HttpError(
        400,
        "invalid_input",
        "Invalid conversation or history cursor.",
      );
    const { chatId, cursor, limit } = query.data;
    const current = await loadAgentSession(request);
    const conversation = await authorizedConversation(
      chatId,
      current.accessToken,
    );
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    const [response, run] = await Promise.all([
      agentFetch(`/sessions/${chatId}/messages?${params}`, current.accessToken),
      cursor ? Promise.resolve(null) : rememberedRun(chatId, current),
    ]);
    await assertUpstream(response);
    const page = z
      .object({ items: z.array(z.unknown()), next_cursor: cursorOutput })
      .parse(await response.json());
    return json({
      conversation,
      messages: await Promise.all(
        page.items.map(async (item) => {
          const empty = emptyAssistant.safeParse(item);
          return empty.success
            ? empty.data
            : (await validateUIMessages({ messages: [item] }))[0]!;
        }),
      ),
      run,
      nextCursor: page.next_cursor,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function stream(request: Request) {
  try {
    const chatId = z
      .uuid()
      .safeParse(new URL(request.url).searchParams.get("chatId"));
    if (!chatId.success)
      throw new HttpError(400, "invalid_input", "Invalid conversation.");
    const current = await loadAgentSession(request);
    await authorizedConversation(chatId.data, current.accessToken);
    const run = await rememberedRun(chatId.data, current);
    if (!run)
      throw new HttpError(
        404,
        "run_unavailable",
        "No recorded run. Refresh conversation history.",
      );
    const upstream = await agentFetch(
      `/runs/${run.id}/stream`,
      current.accessToken,
      {
        signal: request.signal,
      },
    );
    if (upstream.status !== 503) await assertUpstream(upstream);
    return relay(upstream);
  } catch (error) {
    return failure(error);
  }
}
export async function cancel(request: Request) {
  try {
    sameOrigin(request);
    const parsed = z
      .strictObject({ chatId: z.uuid() })
      .safeParse(await inputJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "invalid_input",
        "Choose a conversation to stop.",
      );
    const current = await loadAgentSession(request);
    await authorizedConversation(parsed.data.chatId, current.accessToken);
    const run = await rememberedRun(parsed.data.chatId, current);
    if (!run)
      throw new HttpError(404, "run_unavailable", "No recorded run to cancel.");
    const stopped = await agentFetch(
      `/runs/${run.id}/cancel`,
      current.accessToken,
      {
        method: "POST",
        body: "{}",
      },
    );
    await assertUpstream(stopped);
    return json(
      z
        .object({ status: z.enum(["abort_requested", "not_running"]) })
        .parse(await stopped.json()),
    );
  } catch (error) {
    return failure(error);
  }
}

const connectionOutput = z.object({
  key: z.string(),
  name: z.string(),
  owner: z.enum(["user", "shared"]),
  authorization: z.enum([
    "none",
    "api_key",
    "oauth2",
    "lark_cli",
    "interactive",
  ]),
  status: z.enum([
    "connected",
    "authorization_required",
    "reauthorization_required",
    "administrator_configuration_required",
    "no_authorization_needed",
  ]),
  required_scopes: z.array(z.string()),
  granted_scopes: z.array(z.string()).nullable(),
  actions: z.array(z.enum(["authorize", "write", "disconnect"])),
});
export type ConnectionView = z.infer<typeof connectionOutput>;
async function readConnections(agentId: string, token: string | undefined) {
  const query = new URLSearchParams({
    environment: getAppEnv().AGENT_ENVIRONMENT,
  });
  const response = await agentFetch(
    `/agents/${agentId}/connections?${query}`,
    token,
  );
  await assertUpstream(response);
  const { items } = z
    .object({ items: z.array(connectionOutput) })
    .parse(await response.json());
  // MuseDAM is an explicit prerequisite of this example. Missing declarations are not readiness.
  const musedam = items.find((item) => item.key === "musedam");
  return {
    items,
    ready: musedam?.owner === "user" && musedam.status === "connected",
  };
}
export async function connections(request: Request) {
  try {
    const agentId = z
      .uuid()
      .safeParse(new URL(request.url).searchParams.get("agentId"));
    if (!agentId.success)
      throw new HttpError(400, "invalid_input", "Choose an Agent.");
    const current = await loadAgentSession(request);
    return json(await readConnections(agentId.data, current.accessToken));
  } catch (error) {
    return failure(error);
  }
}
export async function authorizeConnection(request: Request) {
  try {
    sameOrigin(request);
    const input = z
      .object({ agentId: z.uuid(), key: z.literal("musedam") })
      .safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!input.success)
      throw new HttpError(
        400,
        "invalid_input",
        "Choose the MuseDAM connection.",
      );
    const current = await loadAgentSession(request);
    const { items } = await readConnections(
      input.data.agentId,
      current.accessToken,
    );
    const connector = items.find((item) => item.key === input.data.key);
    if (connector?.owner !== "user" || !connector.actions.includes("authorize"))
      throw new HttpError(
        409,
        "configuration_required",
        "The Agent administrator needs to configure MuseDAM first.",
      );
    const query = new URLSearchParams({
      environment: getAppEnv().AGENT_ENVIRONMENT,
    });
    const response = await agentFetch(
      `/agents/${input.data.agentId}/connections/musedam/authorize?${query}`,
      current.accessToken,
      { method: "POST", body: "{}" },
    );
    await assertUpstream(response);
    const result = z
      .object({ authorization_url: z.url(), expires_at: z.iso.datetime() })
      .parse(await response.json());
    const target = new URL(result.authorization_url);
    if (
      (getAppEnv().AGENT_ENVIRONMENT === "local"
        ? target.protocol !== "http:" ||
          !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
          target.pathname !== "/_gea/agent-api/authorization/start"
        : target.origin !== getEnv().OAUTH_ISSUER_URL) ||
      target.username ||
      target.password
    )
      throw new HttpError(
        502,
        "invalid_authorization_url",
        "GEA returned an unexpected authorization URL.",
      );
    return new Response(null, {
      status: 303,
      headers: {
        location: target.href,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
