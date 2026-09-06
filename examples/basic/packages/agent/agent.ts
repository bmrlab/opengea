import { defineAgent } from "@gea-ai/agent-sdk";

export default defineAgent({
  name: "tech-news",
  slug: "tech-news",
  description:
    "Search real Hacker News stories and explain the results with sources.",
  model: "auto",
  modelRequirements: {
    agentic: 0.8,
    copywriting: 0.6,
    speed: 0.6,
  },
  computer: { enabled: false },
});
