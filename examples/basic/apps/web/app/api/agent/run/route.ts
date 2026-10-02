import { agentHttpMessageSchema } from "@gea-ai/contract/agent-http-api";
import { z } from "zod";
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

const inputSchema = z.strictObject({
  chatId: z.uuid().optional(),
  message: agentHttpMessageSchema,
});

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
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) return error(400, "Invalid chat request.");
    const input = parsed.data;
    const session =
      readClaims(cookieValue(request, sessionCookie), env.SESSION_SECRET) ??
      newSession();
    if (input.chatId && !ownedChat(request, input.chatId, env))
      return error(404, "Conversation is unavailable. Start a new chat.");
    const requestHeaders = {
      "content-type": "application/json",
      ...(env.GEA_MODE === "hosted"
        ? { authorization: `Bearer ${env.GEA_PROJECT_API_KEY}` }
        : {}),
    };
    let agentId = env.GEA_AGENT_ID;
    if (!input.chatId && !agentId) {
      const response = await fetch(
        `${env.GEA_AGENTS_API_URL}/agents?environment=local`,
        {
          headers: requestHeaders,
          signal: request.signal,
          redirect: "error",
          cache: "no-store",
        },
      );
      if (!response.ok)
        return error(502, "Could not discover the local Agent.");
      const agents = z
        .object({
          items: z.array(z.object({ id: z.uuid(), name: z.string() })),
        })
        .parse(await response.json());
      agentId = agents.items.find((agent) => agent.name === "tech-news")?.id;
      if (!agentId) return error(502, "Start the local tech-news Agent first.");
    }
    const upstream = await fetch(
      `${env.GEA_AGENTS_API_URL}${input.chatId ? `/sessions/${input.chatId}/runs` : "/sessions"}`,
      {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(
          input.chatId
            ? { input: input.message, stream: true }
            : {
                agent_id: agentId,
                environment:
                  env.GEA_MODE === "local" ? "local" : env.GEA_ENVIRONMENT,
                input: input.message,
                stream: true,
                metadata: {
                  application: "opengea-basic",
                  anonymousSessionId: session.sessionId,
                },
              },
        ),
        signal: request.signal,
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
      },
    );
    const headers = new Headers({ "cache-control": "no-store" });
    for (const name of [
      "content-type",
      "x-vercel-ai-ui-message-stream",
      "x-gea-agent-session-id",
      "x-gea-agent-run-id",
      "x-gea-request-id",
    ]) {
      const value = upstream.headers.get(name);
      if (value !== null) headers.set(name, value);
    }
    const returnedId = inputSchema.shape.chatId.safeParse(
      headers.get("x-gea-agent-session-id"),
    );
    if (headers.has("x-gea-agent-session-id") && !returnedId.success) {
      await upstream.body?.cancel();
      return error(502, "Invalid Agent response.");
    }
    const secure = new URL(env.APP_ORIGIN).protocol === "https:";
    const returnedRunId = inputSchema.shape.chatId.safeParse(
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
          audience: `${env.GEA_AGENTS_API_URL}#${env.GEA_AGENT_ID ?? "tech-news"}#${env.GEA_MODE === "local" ? "local" : env.GEA_ENVIRONMENT}`,
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
