import { defineTool, defineToolSet } from "@gea-ai/agent-sdk";
import { z } from "zod";
import {
  RESEARCH_OBJECT,
  researchInput,
  type ResearchRecord,
} from "../lib/research";

export default defineToolSet([
  defineTool({
    name: "read_research",
    description: "读取当前对话的研究记录。新对话返回 null，不读取其他对话。",
    input: z.object({}),
    execute: async (_input, context) => {
      const response = await context.durableObjects.RESEARCH.getByName(
        RESEARCH_OBJECT,
      ).fetch(
        `https://research.internal/record?id=${encodeURIComponent(context.identity.chat.id)}`,
      );
      if (!response.ok) throw new Error("Research read failed.");
      return (await response.json()) as ResearchRecord | null;
    },
  }),
  defineTool({
    name: "save_research",
    description:
      "保存当前对话的完整研究记录。正文引用和sources链接必须直接复制本对话实际检索到的URL，否则拒绝保存；拒绝后核对工具返回值并纠正，不猜链接。更新前先读取并保留仍有效来源；不要保存凭据或个人隐私。",
    input: researchInput,
    execute: async (input, context) => {
      const response = await context.durableObjects.RESEARCH.getByName(
        RESEARCH_OBJECT,
      ).fetch(
        `https://research.internal/record?id=${encodeURIComponent(context.identity.chat.id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok)
        throw new Error(`Research save rejected: ${await response.text()}`);
      return (await response.json()) as ResearchRecord;
    },
  }),
]);
