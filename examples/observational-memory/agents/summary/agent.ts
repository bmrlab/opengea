import { defineAgent } from "@gea-ai/agent-sdk";
import { agentCore } from "@gea-ai/agent-sdk/agent-core";
import { defaultContext } from "@gea-ai/agent-sdk/context";
import { MAIN_MODEL, MEMORY_MODEL } from "../../models";
export default defineAgent({
  engine: agentCore(),
  name: "summary",
  slug: "summary",
  model: MAIN_MODEL,
  computer: { enabled: false },
  context: defaultContext({
    toolOutput: false,
    preserveRecentGroups: 3,
    summarization: {
      model: MEMORY_MODEL,
      triggerAtTotalTokens: 8000,
      maxOutputTokens: 2000,
    },
  }),
});
