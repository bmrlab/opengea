import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "private-calculator",
  slug: "calculator",
  description:
    "Calculate a small arithmetic result in a third independent Session.",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 4096,
  computer: { enabled: false },
});
