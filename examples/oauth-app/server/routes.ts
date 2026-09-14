import "server-only";
import { z } from "zod";
import { validateUIMessages } from "ai";
import { getEnv } from "./env";
import {
  authorizationUrl,
  agentFetch,
  HttpError,
  revokeRefreshToken,
  tokenRequest,
  userInfo,
} from "./gea";
import { getPool, hash, randomSecret, seal, transaction, unseal } from "./store";
import {
  cookieValue,
  flowCookie,
  loadSession,
  payloadSchema,
  saveSession,
  sessionCookie,
  setCookie,
  type SessionRow,
} from "./session";

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
const redirect = (code?: string) =>
  new Response(null, {
    status: 303,
    headers: {
      location: `${getEnv().APP_ORIGIN}/${code ? `?notice=${encodeURIComponent(code)}` : ""}`,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== getEnv().APP_ORIGIN)
    throw new HttpError(403, "invalid_origin", "Invalid request origin.");
}
// App HTTP edges return bounded, app-authored errors, never raw GEA bodies or tokens.
function failure(error: unknown) {
  return error instanceof HttpError
    ? json({ code: error.code, message: error.message }, error.status)
    : json(
        {
          code: "request_failed",
          message: "The request could not be completed. Retry or check the server configuration.",
        },
        502,
      );
}
async function inputJson(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "invalid_input", "Send a JSON request.");
  const body = await request.text();
  if (Buffer.byteLength(body) > 32768)
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
    const key = hash(proof);
    const previous = cookieValue(request, flowCookie);
    if (previous)
      await getPool().query("DELETE FROM oauth_example_flows WHERE browser_key = $1", [
        hash(previous),
      ]);
    await getPool().query(
      "INSERT INTO oauth_example_flows (browser_key, state_hash, payload, expires_at) VALUES ($1,$2,$3,now() + interval '5 minutes')",
      [key, hash(state), seal({ verifier }, key)],
    );
    const response = new Response(null, {
      status: 303,
      headers: { location: authorizationUrl(state, hash(verifier)), "cache-control": "no-store" },
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
      ["state", "code", "error", "error_description"].some((k) => params.getAll(k).length > 1)
    )
      return redirect("invalid_state");
    const key = hash(proof);
    // DELETE RETURNING atomically consumes state before any code exchange.
    const { rows } = await getPool().query<{ payload: string }>(
      "DELETE FROM oauth_example_flows WHERE browser_key = $1 AND state_hash = $2 AND expires_at > now() RETURNING payload",
      [key, hash(state)],
    );
    if (!rows[0]) return redirect("invalid_state");
    if (params.has("error"))
      response = redirect(
        params.get("error") === "access_denied" ? "access_denied" : "oauth_failed",
      );
    else {
      const code = params.get("code");
      if (!code || code.length > 8192) return redirect("oauth_failed");
      const { verifier } = z.object({ verifier: z.string() }).parse(unseal(rows[0].payload, key));
      const token = await tokenRequest(
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          code_verifier: verifier,
          redirect_uri: `${getEnv().APP_ORIGIN}/auth/callback`,
        }),
      );
      const session = randomSecret();
      await saveSession(hash(session), token);
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
    const current = await loadSession(request);
    const user = await userInfo(current.token.access_token);
    if (user.sub !== current.user.sub)
      throw new HttpError(401, "sign_in_required", "The GEA identity changed. Sign in again.");
    const env = getEnv();
    return json({
      user,
      organization: current.token.organization,
      scopes: current.token.scope.split(/\s+/),
      expiresAt: current.row.expires_at.toISOString(),
      agents: await discoverAgents(current.token.access_token),
      environment: env.GEA_ENVIRONMENT,
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
      !cookie ||
      (await transaction(async (client) => {
        const key = hash(cookie);
        const { rows } = await client.query<SessionRow>(
          "SELECT * FROM oauth_example_sessions WHERE session_key = $1 FOR UPDATE",
          [key],
        );
        if (!rows[0]) return true;
        const { token } = payloadSchema.parse(unseal(rows[0].payload, key));
        // Shares the refresh lock: logout cannot race a refresh and resurrect tokens.
        try {
          // GEA also invalidates the access tokens associated with this refresh token.
          await revokeRefreshToken(token.refresh_token);
        } catch {
          await client.query(
            "UPDATE oauth_example_sessions SET status = 'logout_pending' WHERE session_key = $1",
            [key],
          );
          return false;
        }
        await client.query("DELETE FROM oauth_example_sessions WHERE session_key = $1", [key]);
        return true;
      }));
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
  environment: z.enum(["preview", "production"]),
});
const conversationOutput = z.object({
  id: z.uuid(),
  agent_id: z.uuid(),
  environment: z.enum(["preview", "production"]),
  title: z.string().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});
const runOutput = z.object({ id: z.uuid(), session_id: z.uuid(), status: z.string() });
const cursorOutput = z.string().min(1).nullable();
const pageQuery = z.object({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const runInput = z
  .strictObject({
    chatId: z.uuid().optional(),
    agentId: z.uuid().optional(),
    message: z.string().trim().min(1).max(8000),
  })
  .refine((v) => Boolean(v.chatId) !== Boolean(v.agentId));
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
      [401, 403, 404, 409, 429, 503].includes(response.status) ? response.status : 502,
      "agent_failed",
      response.status === 403
        ? "GEA has not granted this user and application access to the Agent. Check the application's environment setup."
        : response.status === 404
          ? "This conversation or Agent is unavailable to your GEA account."
          : response.status === 409
            ? "This conversation already has an active run. Restore it before sending another message."
            : "The Agent request failed. Refresh history to check whether a conversation was created before sending again.",
    );
  }
}
async function discoverAgents(token: string) {
  const agents: AgentView[] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ environment: getEnv().GEA_ENVIRONMENT, limit: "100" });
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
    const query = pageQuery.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!query.success) throw new HttpError(400, "invalid_input", "Invalid history cursor.");
    const current = await loadSession(request);
    const params = new URLSearchParams({
      environment: getEnv().GEA_ENVIRONMENT,
      limit: String(query.data.limit),
    });
    if (query.data.cursor) params.set("cursor", query.data.cursor);
    const response = await agentFetch(`/sessions?${params}`, current.token.access_token);
    await assertUpstream(response);
    return json(
      z
        .object({ items: z.array(conversationOutput), next_cursor: cursorOutput })
        .parse(await response.json()),
    );
  } catch (error) {
    return failure(error);
  }
}
async function authorizedConversation(chatId: string, token: string) {
  const response = await agentFetch(`/sessions/${chatId}`, token);
  await assertUpstream(response);
  const conversation = conversationOutput.parse(await response.json());
  if (conversation.id !== chatId || conversation.environment !== getEnv().GEA_ENVIRONMENT)
    throw new HttpError(404, "chat_unavailable", "Conversation unavailable.");
  return conversation;
}
// GEA has no list-Runs/latest-Run field. Retain only the returned Run reference;
// messages and session ownership are always read from GEA, including after a new login.
async function rememberedRun(chatId: string, token: string) {
  const { rows } = await getPool().query<{ run_id: string }>(
    "SELECT run_id FROM oauth_example_runs WHERE session_id = $1",
    [chatId],
  );
  if (!rows[0]) return null;
  const response = await agentFetch(`/runs/${rows[0].run_id}`, token);
  await assertUpstream(response);
  const run = runOutput.parse(await response.json());
  if (run.session_id !== chatId || run.id !== rows[0].run_id)
    throw new HttpError(502, "invalid_agent_response", "Unexpected execution identity.");
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
        "Choose an Agent or conversation and enter a message of at most 8,000 characters.",
      );
    const current = await loadSession(request);
    const { chatId, agentId, message } = parsed.data;
    if (chatId) await authorizedConversation(chatId, current.token.access_token);
    // Exactly one write. Never replay a user turn after an ambiguous network failure.
    const upstream = await agentFetch(
      chatId ? `/sessions/${chatId}/runs` : "/sessions",
      current.token.access_token,
      {
        method: "POST",
        body: JSON.stringify(
          chatId
            ? { input: message, stream: true }
            : {
                agent_id: agentId,
                environment: getEnv().GEA_ENVIRONMENT,
                title: message.slice(0, 80),
                input: message,
                stream: true,
              },
        ),
        signal: request.signal,
      },
    );
    const sessionId = upstream.headers.get("x-gea-agent-session-id"),
      runId = upstream.headers.get("x-gea-agent-run-id");
    if (
      (sessionId && (!z.uuid().safeParse(sessionId).success || (chatId && chatId !== sessionId))) ||
      (runId && (!sessionId || !z.uuid().safeParse(runId).success))
    ) {
      await upstream.body?.cancel();
      throw new HttpError(502, "invalid_agent_response", "Unexpected conversation identity.");
    }
    createdId = sessionId;
    if (sessionId && runId)
      await getPool().query(
        "INSERT INTO oauth_example_runs (session_id, run_id) VALUES ($1,$2) ON CONFLICT (session_id) DO UPDATE SET run_id = EXCLUDED.run_id",
        [sessionId, runId],
      );
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
      throw new HttpError(400, "invalid_input", "Invalid conversation or history cursor.");
    const { chatId, cursor, limit } = query.data;
    const current = await loadSession(request);
    const conversation = await authorizedConversation(chatId, current.token.access_token);
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    const [response, run] = await Promise.all([
      agentFetch(`/sessions/${chatId}/messages?${params}`, current.token.access_token),
      cursor ? Promise.resolve(null) : rememberedRun(chatId, current.token.access_token),
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
          return empty.success ? empty.data : (await validateUIMessages({ messages: [item] }))[0]!;
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
    const chatId = z.uuid().safeParse(new URL(request.url).searchParams.get("chatId"));
    if (!chatId.success) throw new HttpError(400, "invalid_input", "Invalid conversation.");
    const current = await loadSession(request);
    await authorizedConversation(chatId.data, current.token.access_token);
    const run = await rememberedRun(chatId.data, current.token.access_token);
    if (!run)
      throw new HttpError(404, "run_unavailable", "No recorded run. Refresh conversation history.");
    const upstream = await agentFetch(`/runs/${run.id}/stream`, current.token.access_token, {
      signal: request.signal,
    });
    if (upstream.status !== 503) await assertUpstream(upstream);
    return relay(upstream);
  } catch (error) {
    return failure(error);
  }
}
export async function cancel(request: Request) {
  try {
    sameOrigin(request);
    const parsed = z.strictObject({ chatId: z.uuid() }).safeParse(await inputJson(request));
    if (!parsed.success)
      throw new HttpError(400, "invalid_input", "Choose a conversation to stop.");
    const current = await loadSession(request);
    await authorizedConversation(parsed.data.chatId, current.token.access_token);
    const run = await rememberedRun(parsed.data.chatId, current.token.access_token);
    if (!run) throw new HttpError(404, "run_unavailable", "No recorded run to cancel.");
    const stopped = await agentFetch(`/runs/${run.id}/cancel`, current.token.access_token, {
      method: "POST",
      body: "{}",
    });
    await assertUpstream(stopped);
    return json(
      z.object({ status: z.enum(["abort_requested", "not_running"]) }).parse(await stopped.json()),
    );
  } catch (error) {
    return failure(error);
  }
}
