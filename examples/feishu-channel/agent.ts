import { feishuAgentExtension } from "@gea-ai/agent-extension-feishu";
import { defineAgent } from "@gea-ai/agent-sdk";
import { withoutAuthorizationEcho } from "./lib/auth-replies.ts";

const feishu = feishuAgentExtension();
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
