import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "feishu-assistant",
  slug: "feishu-assistant",
  description: "A private-chat assistant connected to Feishu.",
  model: "creative-reasoning-1.5",
  computer: { enabled: false },
});
