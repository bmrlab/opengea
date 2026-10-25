import { feishuAgentExtension } from "@gea-ai/agent-extension-feishu";
import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "feishu-assistant",
  slug: "feishu-assistant",
  description: "A private-chat assistant connected to Feishu.",
  model: "deepseek-v4.1-flash",
  extensions: [{ extension: feishuAgentExtension(), namespace: "feishu" }],
  computer: { enabled: false },
});
