import { z } from "zod";
import { DefaultChatTransport, readUIMessageStream, validateUIMessages, type UIMessage } from "ai";
import type { AgentView, ConversationSummary } from "../server/routes";
export type { ConversationSummary } from "../server/routes";

export type SessionView = {
  user: { sub: string; name?: string | null };
  organization: { id: string; name: string; slug: string };
  scopes: string[];
  expiresAt: string;
  agents: AgentView[];
  environment: "preview" | "production";
};
export type ConversationView = {
  messages: UIMessage[];
  conversation: ConversationSummary;
  run: { id: string; session_id: string; status: string } | null;
  nextCursor: string | null;
};
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function checked(response: Response) {
  if (!response.ok) {
    let message = "The request failed. Restore the conversation before trying another message.";
    // Our HTTP edge returns a small, bounded error shape; proxy HTML is not copy.
    try {
      const body: unknown = await response.json();
      if (body && typeof body === "object" && "message" in body && typeof body.message === "string")
        message = body.message;
    } catch {
      /* A hosting proxy can return a non-JSON error page. */
    }
    throw new ApiError(response.status, message);
  }
  return response;
}
export async function readSession(signal?: AbortSignal): Promise<SessionView> {
  return (await checked(await fetch("/api/session", { cache: "no-store", signal }))).json();
}
export async function readConversations(
  cursor?: string | null,
  signal?: AbortSignal,
): Promise<{ items: ConversationSummary[]; next_cursor: string | null }> {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);
  return (
    await checked(await fetch(`/api/conversations?${query}`, { cache: "no-store", signal }))
  ).json();
}
export async function readHistory(
  chatId: string,
  signal?: AbortSignal,
  cursor?: string | null,
): Promise<ConversationView> {
  const query = new URLSearchParams({ chatId });
  if (cursor) query.set("cursor", cursor);
  return (await checked(await fetch(`/api/chat?${query}`, { cache: "no-store", signal }))).json();
}
class StreamDecoder extends DefaultChatTransport<UIMessage> {
  decode(stream: ReadableStream<Uint8Array>) {
    return this.processResponseStream(stream);
  }
}
const decoder = new StreamDecoder();
export async function consume(
  response: Response,
  onMessage: (message: UIMessage) => void,
  replayIdentity?: { chatId: string; runId: string },
) {
  await checked(response);
  if (response.status === 204) return;
  if (!response.body) throw new Error("No response stream. Restore this conversation.");
  let previous: UIMessage | undefined;
  if (replayIdentity) {
    // GEA prefixes a replay with the pre-Run assistant message. Reset to it before
    // decoding the buffered deltas; the current UI may already contain those deltas.
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    try {
      let prefix = "";
      while (!prefix.includes("\n")) {
        const next = await reader.read();
        if (next.done) throw new Error("Missing replay baseline. Restore history.");
        prefix += next.value;
      }
      const end = prefix.indexOf("\n");
      const line = prefix.slice(0, end);
      if (!line.startsWith(": gea-replay "))
        throw new Error("Missing replay baseline. Restore history.");
      const replay = z
        .object({
          version: z.literal(1),
          chatId: z.string(),
          runId: z.string(),
          message: z.object({
            id: z.string(),
            role: z.literal("assistant"),
            parts: z.array(z.unknown()),
            metadata: z.unknown().optional(),
          }),
        })
        .parse(JSON.parse(line.slice(": gea-replay ".length)));
      if (replay.chatId !== replayIdentity.chatId || replay.runId !== replayIdentity.runId)
        throw new Error("Unexpected replay identity. Restore history.");
      previous = replay.message.parts.length
        ? (await validateUIMessages({ messages: [replay.message] }))[0]!
        : {
            id: replay.message.id,
            role: "assistant",
            parts: [],
            metadata: replay.message.metadata,
          };
      onMessage(previous);
      const remainder = prefix.slice(end + 1);
      response = new Response(
        new ReadableStream<string>({
          start(controller) {
            if (remainder) controller.enqueue(remainder);
          },
          async pull(controller) {
            const next = await reader.read();
            if (next.done) {
              reader.releaseLock();
              controller.close();
            } else controller.enqueue(next.value);
          },
          async cancel(reason) {
            await reader.cancel(reason);
            reader.releaseLock();
          },
        }).pipeThrough(new TextEncoderStream()),
      );
    } catch (error) {
      try {
        await reader.cancel(error);
      } finally {
        reader.releaseLock();
      }
      throw error;
    }
  }
  for await (const message of readUIMessageStream<UIMessage>({
    stream: decoder.decode(response.body!),
    terminateOnError: true,
    ...(previous?.role === "assistant" ? { message: previous } : {}),
  }))
    onMessage(message);
}
export async function openStream(chatId: string, signal?: AbortSignal) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`/api/chat/stream?chatId=${encodeURIComponent(chatId)}`, {
      cache: "no-store",
      signal,
    });
    if (response.status !== 503) return response;
    const delay = Math.min(
      5000,
      Math.max(500, Number(response.headers.get("retry-after")) * 1000 || 500),
    );
    await response.body?.cancel();
    await new Promise<void>((resolve, reject) => {
      const stop = () => {
        clearTimeout(timer);
        reject(signal?.reason);
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", stop);
        resolve();
      }, delay);
      if (signal?.aborted) stop();
      else signal?.addEventListener("abort", stop, { once: true });
    });
  }
  throw new Error("The stream is not ready yet. Use Restore conversation in a moment.");
}
