import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";

export default defineTool({
  name: "pause",
  description:
    "Hold this child Run briefly, then return its real execution identity.",
  input: z.object({
    label: z.string(),
    holdMs: z.number().int().min(0).max(60000),
  }),
  async execute({ label, holdMs }, context) {
    await new Promise<void>((resolve) => setTimeout(resolve, holdMs));
    return {
      label,
      holdMs,
      sessionId: context.identity.chat.id,
      runId: context.identity.run.id,
    };
  },
});
