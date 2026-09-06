import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "tech-news",
  slug: "tech-news",
  description:
    "Search real Hacker News stories and explain the results with sources.",
  model: "creative-reasoning-1.5",
  computer: { enabled: false },
});
