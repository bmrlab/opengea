import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  engine: "ai-sdk",
  name: "backpack",
  slug: "backpack",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 1024,
  computer: { enabled: false },
});
