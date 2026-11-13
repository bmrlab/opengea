import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  engine: "ai-sdk",
  name: "backpack",
  slug: "backpack",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 4096,
  computer: { enabled: false },
});
