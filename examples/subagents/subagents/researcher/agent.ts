import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "private-researcher",
  slug: "researcher",
  description:
    "A private specialist which asks its own calculator subagent for evidence.",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 8192,
  computer: { enabled: false },
});
