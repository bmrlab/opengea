import { defineTool, defineToolSet } from "@gea-ai/agent-sdk";
import { z } from "zod";
import {
  RESEARCH_OBJECT,
  referencedResearchInput,
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
      "保存当前对话的研究记录。report 用 [[sourceId]] 引用，sources 选择本次捕获的 sourceId；不手写 URL。返回的 report 已生成完整链接，直接交付。更新前先读取；不要保存凭据或个人隐私。",
    input: referencedResearchInput,
    execute: async (input, context) => {
      const response = await context.durableObjects.RESEARCH.getByName(
        RESEARCH_OBJECT,
      ).fetch(
        `https://research.internal/referenced-record?id=${encodeURIComponent(context.identity.chat.id)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (response.status === 400) return { saved: false, ...(await response.json() as { error: string }) };
      if (!response.ok) throw new Error("Research save failed.");
      return (await response.json()) as ResearchRecord;
    },
  }),
]);
