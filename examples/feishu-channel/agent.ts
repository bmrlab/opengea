import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "feishu-assistant",
  slug: "feishu-assistant",
  description: "A Feishu assistant for private chats and shared group topics.",
  model: "creative-reasoning-1.5",
  computer: { enabled: false },
});
