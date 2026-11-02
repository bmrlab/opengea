import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";

export default defineAgent({
  engine: agentCore(),
  name: "remote-agent-caller",
  slug: "remote-agent-caller",
  description:
    "Delegate a request to an independently admitted Agent by its public ID.",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 2048,
  computer: { enabled: false },
});
