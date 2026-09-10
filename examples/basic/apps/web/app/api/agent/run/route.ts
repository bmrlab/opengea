import { StudioAgentClient } from "@gea-ai/agent-sdk/studio-server";
import { studioAgentClientRunInputSchema } from "@gea-ai/contract/studio-agent-api";
import { getEnv } from "../../../../server/env";
import {
  chatCookie,
  cookieValue,
  newSession,
  ownedChat,
  readClaims,
  sessionCookie,
  setClaims,
} from "../../../../server/session";

export const runtime = "nodejs";
// Hosting providers apply their own upper bound; this is a request, not a guarantee.
export const maxDuration = 120;

function error(status: number, message: string) {
  return Response.json(
    { message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  // Route Handler is the HTTP protocol boundary. Never return transport/configuration exceptions.
  try {
    const env = getEnv();
    if (request.headers.get("origin") !== env.APP_ORIGIN)
      return error(403, "Invalid request origin.");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return error(415, "Send JSON.");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error(400, "Invalid JSON.");
    }
    const parsed = studioAgentClientRunInputSchema.safeParse(body);
    if (!parsed.success) return error(400, "Invalid chat request.");
    const input = parsed.data;
    const session =
      readClaims(cookieValue(request, sessionCookie), env.SESSION_SECRET) ??
      newSession();
    if (input.chatId && !ownedChat(request, input.chatId, env))
      return error(404, "Conversation is unavailable. Start a new chat.");
    const upstream =
      env.GEA_MODE === "hosted"
        ? await new StudioAgentClient({
            api: env.GEA_AGENT_URL,
            apiKey: env.GEA_PROJECT_API_KEY ?? "",
          }).run(
            input.chatId
              ? input
              : {
                  ...input,
                  metadata: {
                    application: "opengea-basic",
                    anonymousSessionId: session.sessionId,
                  },
                },
            { signal: request.signal },
          )
        : await fetch(`${env.GEA_AGENT_URL}/run`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
            signal: request.signal,
            credentials: "omit",
            redirect: "error",
            cache: "no-store",
          });
    const headers = new Headers({ "cache-control": "no-store" });
    for (const name of [
      "content-type",
      "x-vercel-ai-ui-message-stream",
      "x-gea-agent-chat-id",
      "x-gea-agent-run-id",
      "x-gea-request-id",
    ]) {
      const value = upstream.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const returnedId = studioAgentClientRunInputSchema.shape.chatId.safeParse(
      headers.get("x-gea-agent-chat-id"),
    );
    if (headers.has("x-gea-agent-chat-id") && !returnedId.success) {
      await upstream.body?.cancel();
      return error(502, "Invalid Agent response.");
    }
    const secure = new URL(env.APP_ORIGIN).protocol === "https:";
    const returnedRunId =
      studioAgentClientRunInputSchema.shape.chatId.safeParse(
        headers.get("x-gea-agent-run-id"),
      );
    setClaims(headers, sessionCookie, session, env.SESSION_SECRET, secure);
    if (returnedId.success && returnedId.data) {
      if (input.chatId && returnedId.data !== input.chatId) {
        await upstream.body?.cancel();
        return error(502, "Unexpected conversation identity.");
      }
      // Grant ownership before forwarding any bytes, even if startup returned an HTTP error.
      setClaims(
        headers,
        chatCookie(returnedId.data),
        {
          ...session,
          chatId: returnedId.data,
          ...(returnedRunId.success && returnedRunId.data
            ? { runId: returnedRunId.data }
            : {}),
          audience: env.GEA_AGENT_URL,
        },
        env.SESSION_SECRET,
        secure,
      );
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch {
    return error(
      502,
      "Could not reach the Agent. Check the server configuration and Agent process.",
    );
  }
}
