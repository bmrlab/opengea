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
  return /\/api\/agent-connectors\/oauth\/start|\bticket\s*[=:]/iu.test(text) ? safeNotice : text;
}

export function withoutAuthorizationEcho<TState, TContext, TPayload>(
  channel: DefinedChannel<TState, TContext, TPayload>,
): DefinedChannel<TState, TContext, TPayload> {
  return {
    ...channel,
    events: Object.fromEntries(Object.entries(channel.events).map(([type, handler]) => [
      type,
      type.startsWith("tool-") || type === "text-delta"
        // Raw tool previews include card argv/Host results. A URL or ticket can
        // also span text deltas, so defer all answer text to the terminal event.
        // This changes presentation only; model inputs and tool execution remain intact.
        ? () => {}
        : type === "run.succeeded"
          ? (event, ctx) => {
            const data = completed.passthrough().parse(event.data);
            return handler({
              ...event,
              data: { ...data, reply: { ...data.reply, text: authorizationReplyText(data.reply.text) } },
            }, ctx);
          }
          : handler,
    ])),
  };
}
