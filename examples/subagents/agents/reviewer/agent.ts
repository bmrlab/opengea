import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";

export default defineAgent({
  engine: agentCore(),
  name: "independent-reviewer",
  slug: "reviewer",
  description:
    "Check arithmetic and demonstrate a top-level Agent's own history.",
  model: "creative-reasoning-1.5",
  maxOutputTokens: 4096,
  computer: { enabled: false },
});
