import { validateUIMessages } from "ai";
import type { NewsMessage } from "@opengea/basic-agent/messages";
import { z } from "zod";
import { getEnv } from "../../../../../../server/env";
import { ownedChat } from "../../../../../../server/session";

export const runtime = "nodejs";
export const maxDuration = 120;
type Context = { params: Promise<{ chatId: string; operation: string }> };
const routeSchema = z.object({
  chatId: z.uuid(),
  operation: z.enum(["state", "cancel"]),
});
const cancelSchema = z.strictObject({ runId: z.uuid() });
const runSchema = z.object({
  id: z.uuid(),
  chatId: z.uuid(),
  status: z.string(),
});
const pageSchema = z.object({
  items: z.array(z.unknown()),
  nextCursor: z.unknown().nullable(),
});
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });

async function handle(request: Request, context: Context) {
  // The application's HTTP edge validates ownership before using its Project key.
  try {
    const parsed = routeSchema.safeParse(await context.params);
    if (!parsed.success)
      return json({ message: "Unknown conversation operation." }, 404);
    const { chatId, operation } = parsed.data;
    if ((operation === "cancel") !== (request.method === "POST"))
      return json({ message: "Method not allowed." }, 405);
    const env = getEnv();
    if (
      request.method === "POST" &&
      request.headers.get("origin") !== env.APP_ORIGIN
    )
      return json({ message: "Invalid request origin." }, 403);
    const grant = ownedChat(request, chatId, env);
    if (!grant)
      return json(
        { message: "Conversation is unavailable. Start a new chat." },
        404,
      );
    if (env.GEA_MODE !== "hosted")
      return json(
        {
          message:
            "History and explicit cancellation require hosted Agent execution.",
        },
        501,
      );
    // The published SDK currently wraps run/resume; these are the documented
    // history and cancellation HTTP endpoints, with a fixed server-owned target.
    const fetchAgent = (path: string, method = "GET") =>
      fetch(`${env.GEA_AGENT_URL}${path}`, {
        method,
        signal: request.signal,
        headers: { Authorization: `Bearer ${env.GEA_PROJECT_API_KEY}` },
        credentials: "omit",
        redirect: "error",
        cache: "no-store",
      });
    if (operation === "cancel") {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return json({ message: "Send JSON." }, 415);
      let input: unknown;
      try {
        input = await request.json();
      } catch {
        return json({ message: "Invalid JSON." }, 400);
      }
      const body = cancelSchema.safeParse(input);
      if (!body.success)
        return json({ message: "Invalid cancellation request." }, 400);
      // Bind the Run to the owned Chat, even when a caller guesses another Run ID.
      const response = await fetchAgent(`/runs/${body.data.runId}`);
      if (!response.ok)
        return json({ message: "Run is unavailable." }, response.status);
      const run = runSchema.parse(await response.json());
      if (run.chatId !== chatId || run.id !== body.data.runId)
        return json({ message: "Run is unavailable." }, 404);
      const cancelled = await fetchAgent(`/runs/${run.id}/cancel`, "POST");
      if (!cancelled.ok)
        return json(
          { message: "Could not request cancellation." },
          cancelled.status,
        );
      return json(
        z
          .object({ status: z.enum(["abort_requested", "not_running"]) })
          .parse(await cancelled.json()),
      );
    }
    const [messagesResponse, runResponse] = await Promise.all([
      fetchAgent(`/chats/${chatId}/messages?limit=100`),
      grant.runId ? fetchAgent(`/runs/${grant.runId}`) : Promise.resolve(null),
    ]);
    if (!messagesResponse.ok)
      return json(
        { message: "Could not load this conversation." },
        messagesResponse.status,
      );
    if (runResponse && !runResponse.ok)
      return json(
        { message: "Could not load execution status." },
        runResponse.status,
      );
    const page = pageSchema.parse(await messagesResponse.json());
    const messages = await validateUIMessages<NewsMessage>({
      messages: page.items,
    });
    const run = runResponse ? runSchema.parse(await runResponse.json()) : null;
    if (run && (run.chatId !== chatId || run.id !== grant.runId))
      return json({ message: "Unexpected conversation identity." }, 502);
    return json({ messages, run, hasOlderMessages: page.nextCursor !== null });
  } catch {
    return json(
      { message: "Could not complete the conversation request." },
      502,
    );
  }
}
export const GET = handle;
export const POST = handle;
