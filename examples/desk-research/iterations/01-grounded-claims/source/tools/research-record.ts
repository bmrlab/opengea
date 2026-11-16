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
      // Expected validation failures must remain visible to the model. Runtime
      // sanitizes thrown exceptions, hiding the URLs that need correction.
      if (response.status === 400) {
        const rejection = (await response.json()) as {
          error: string;
          urls?: string[];
          availableUrls?: string[];
        };
        return {
          saved: false,
          error: rejection.error,
          urls: rejection.urls ?? [],
          availableUrls: rejection.availableUrls ?? [],
          instruction:
            "记录尚未保存。availableUrls是本对话已捕获的同域名URL候选，核对各自正文后纠正正文与sources；候选不证明事实支持，不可盲目替换。不要猜链接或宣称已保存。",
        };
      }
      if (!response.ok) throw new Error("Research save failed.");
      return (await response.json()) as ResearchRecord;
    },
  }),
]);
