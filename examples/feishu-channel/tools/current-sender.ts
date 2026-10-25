import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";

export default defineTool({
  name: "current_sender",
  description:
    "Read the authenticated sender, private/shared conversation boundary, and fixed per-run authorization-card key. Never infer a Feishu recipient from principalId.",
  input: z.object({}),
  async execute(_input, ctx) {
    const principal = ctx.auth.current;
    const openId =
      principal?.principalType === "user"
        ? principal.attributes?.feishuOpenId
        : undefined;
    const runId = ctx.identity?.run?.id;
    const digest = runId
      ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(runId))
      : null;
    return {
      principal,
      environment: ctx.environment,
      senderOpenId: typeof openId === "string" && openId.length > 0 ? openId : null,
      // SDK conversationScope denotes shared ownership; its absence on a valid
      // runtime identity is sender-scoped. Incomplete identity is unsafe.
      sharedConversation:
        !ctx.identity?.chat?.id ||
        !runId ||
        ctx.identity.conversationScope !== undefined,
      authCardKey: digest
        ? `auth-${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 40)}`
        : null,
    };
  },
});
