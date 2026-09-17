import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";

export default defineAgent({
  engine: agentCore(),
  name: "subagent-coordinator",
  slug: "coordinator",
  description:
    "Delegate work to a private specialist, a top-level Agent and a self copy.",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 8192,
  computer: { enabled: false },
});
