import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "independent-reviewer",
  slug: "reviewer",
  description:
    "Check arithmetic and demonstrate a top-level Agent's own history.",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 4096,
  computer: { enabled: false },
});
