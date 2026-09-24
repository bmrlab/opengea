import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";

export default defineAgent({
  engine: agentCore({ maxSteps: 64 }),
  name: "subagent-limits",
  slug: "limits",
  description:
    "Exercise bounded child concurrency and reusable capacity in one Session.",
  model: "creative-reasoning-1.5",
  maxConcurrentSubagents: 2,
  maxOutputTokens: 2048,
  computer: { enabled: false },
});
