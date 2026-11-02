import { feishuAgentExtension } from "@gea-ai/agent-extension-feishu";
import { defineAgent } from "@gea-ai/agent-sdk";
import { withoutAuthorizationEcho } from "./lib/auth-replies.ts";
import { matchFeishuAccount } from "./lib/platform-user-matcher.ts";

// Matcher identity requires Runtime-attested managed receiver frames (ADR-0009).
// The published extension owns connection resume, ctx.event and Host references.
const feishu = feishuAgentExtension({
  transport: "websocket",
  platformUserMatcher: matchFeishuAccount,
});
const channels = feishu.channels.map((channel) => {
  if (!("events" in channel)) throw new Error("Expected an executable Feishu Channel.");
  return withoutAuthorizationEcho(channel);
});

export default defineAgent({
  name: "feishu-assistant",
  slug: "feishu-assistant",
  description: "A private-chat assistant connected to Feishu.",
  model: "deepseek-v4.1-flash",
  extensions: [{ extension: { ...feishu, channels }, namespace: "feishu" }],
  computer: { enabled: false },
});
