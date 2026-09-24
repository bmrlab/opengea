import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";

export default defineAgent({
  engine: agentCore(),
  name: "limits-worker",
  slug: "worker",
  description: "Hold one child Run briefly and report its execution identity.",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 512,
  computer: { enabled: false },
});
