import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";

export default defineTool({
  name: "current_sender",
  description:
    "Read the authenticated sender identity of this Agent execution.",
  input: z.object({}),
  execute(_input, ctx) {
    return {
      principal: ctx.auth.current,
      environment: ctx.environment,
    };
  },
});
