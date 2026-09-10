import { defineAgent, env } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";

export default defineAgent({
  name: "tech-news",
  slug: "tech-news",
  description:
    "Search real Hacker News stories and explain the results with sources.",
  model: "auto",
  engine: agentCore(),
  modelRequirements: {
    agentic: 0.8,
    copywriting: 0.6,
    speed: 0.6,
  },
  computer: { enabled: false },
  env: {
    REQUIRE_SEARCH_APPROVAL: env.value({
      description:
        "Search requires approval by default. Set to false for unattended execution.",
    }),
  },
});
