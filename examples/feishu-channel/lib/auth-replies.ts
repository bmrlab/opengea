import type { DefinedChannel } from "@gea-ai/agent-sdk/channels";
import { z } from "zod";

// Keep these exact replies aligned with the bundled authorization Skill.
const authorizationReplies = [
  "授权卡已发送，请点击「前往授权」，完成后回到此私聊发消息继续。",
  "授权卡未发送，请稍后再发一条消息重试。",
  "授权卡发送结果尚未确认，请先检查此私聊中的授权卡；如已收到，完成授权后再发消息继续。",
  "授权卡未发送，暂时无法获取有效授权入口，请稍后发消息重试。",
  "请在私聊中发消息继续授权。",
];
const safeNotice = "请查看此私聊中的授权卡；如未收到，请稍后再发一条消息重试。";
const completed = z.object({ reply: z.object({ text: z.string() }).passthrough() });

export function authorizationReplyText(text: string): string {
  // The pinned SDK appends the original Host URL to authorization replies.
  // Replace the whole reply, rather than trying to redact opaque ticket fragments
  // or model-rewritten links. Unrecognized copy must not claim delivery success.
  const fixedReply = authorizationReplies.find((reply) => text.trimStart().startsWith(reply));
  if (fixedReply) return fixedReply;
  // The SDK appends the known Host OAuth entry whenever authorization tool
  // output is present. A bare ticket field is also ordinary business data or
  // source code, so it cannot establish authorization context on its own.
  return /\/api\/agent-connectors\/oauth\/start/iu.test(text) ? safeNotice : text;
}

// An authorization entry (or the ticket after it) may appear in tool data or in
// streamed text, possibly split across deltas.
const authorizationMarker = /\/api\/agent-connectors\/oauth\/start|ticket[=:]/iu;
type StreamingState = { outputs?: Record<string, { text?: string; streamFailed?: boolean }> };

export function withoutAuthorizationEcho<TState, TContext, TPayload>(
  channel: DefinedChannel<TState, TContext, TPayload>,
): DefinedChannel<TState, TContext, TPayload> {
  type Handler = (typeof channel.events)[string];
  // `streamFailed` is the extension's persisted "stop streaming" flag: the card
  // closes with what was already shown and the terminal reply replaces it.
  const reply = (ctx: Parameters<Handler>[1], operationId: string) =>
    (ctx.state as StreamingState).outputs?.[operationId];
  const guarded = (type: string, handler: Handler): Handler => {
    if (type === "text-delta")
      return async (event, ctx) => {
        const delta = z.object({ delta: z.string().optional() }).passthrough().parse(event.data);
        const current = reply(ctx, event.operationId);
        if (current?.streamFailed) return;
        // Keep a bounded tail so a marker split across deltas is still found.
        if (authorizationMarker.test(`${current?.text?.slice(-64) ?? ""}${delta.delta ?? ""}`)) {
          await handler({ ...event, data: { ...delta, delta: "" } }, ctx);
          const created = reply(ctx, event.operationId);
          if (created) created.streamFailed = true;
          return;
        }
        return handler(event, ctx);
      };
    if (type.startsWith("tool-"))
      // Tool previews render fixed status labels only; tool data never reaches the card.
      return async (event, ctx) => {
        await handler(event, ctx);
        const current = reply(ctx, event.operationId);
        if (current && authorizationMarker.test(JSON.stringify(event.data))) current.streamFailed = true;
      };
    if (type === "run.succeeded")
      return (event, ctx) => {
        const data = completed.passthrough().parse(event.data);
        return handler({
          ...event,
          data: { ...data, reply: { ...data.reply, text: authorizationReplyText(data.reply.text) } },
        }, ctx);
      };
    return handler;
  };
  return {
    ...channel,
    events: Object.fromEntries(
      Object.entries(channel.events).map(([type, handler]) => [type, guarded(type, handler)]),
    ),
  };
}
