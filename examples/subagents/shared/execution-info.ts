import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";

export default defineTool({
  name: "execution_info",
  description: "Read this execution's actual Agent, chat and run identities.",
  input: z.object({}),
  execute(_input, context) {
    return {
      agentId: context.identity.agent.id,
      chatId: context.identity.chat.id,
      runId: context.identity.run.id,
    };
  },
});
