import { defineTool } from "@gea-ai/agent-sdk";
import { z } from "zod";

export default defineTool({
  name: "savePreparedReport",
  description:
    "Save a report combining an attached file and the prepared workspace.",
  input: z.object({
    fileId: z.string().describe("The attached managed file ID"),
  }),
  permissions: { workspace: ["read"] },
  execute: async ({ fileId }, ctx) => {
    if (!ctx.artifacts || !ctx.computer)
      throw new Error("This tool requires managed files and a Computer.");
    const [source, setup] = await Promise.all([
      ctx.artifacts.readText({ id: fileId }),
      ctx.computer.workspace.readText("setup.txt"),
    ]);
    return ctx.artifacts.put({
      key: "report.txt",
      filename: "report.txt",
      contentType: "text/plain",
      content: `Source:\n${source}\nWorkspace:\n${setup}`,
    });
  },
});
