import { defineAgent } from "@gea-ai/agent-sdk";
import { defineMemory } from "@gea-ai/agent-sdk/memory";

export { AgentMemory } from "@gea-ai/agent-sdk/memory";

// A shared notebook for this Agent within one organization/Worker installation.
// Tool-only mode makes reads and lexical searches explicit in the conversation.
const memory = defineMemory({
  enabled: true,
  recall: false,
  slot: "notebook",
  scope: "agent",
});

export default defineAgent({
  name: "memory-notebook",
  slug: "memory-notebook",
  description:
    "Remember, read and search durable project facts across Sessions.",
  model: "auto",
  modelRequirements: { agentic: 0.8 },
  computer: { enabled: false },
  ...memory,
});
