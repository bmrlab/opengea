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
      "保存当前对话的完整研究记录。sources只填写search_sources/read_source返回的sourceId，report用[[sourceId]]引用，不手抄URL；工具按本对话捕获记录生成完整URL，返回已保存的完整简报供最终答复使用。标识只证明来源身份，不证明事实支持。更新前先读取并保留仍有效来源；不要保存凭据或个人隐私。",
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
            "记录尚未保存。请核对原工具返回的sourceId和正文：sources使用该sourceId，report写[[sourceId]]，不要填写URL或猜标识；每条引用都必须列在sources中。标识不证明事实支持，不可盲目替换。",
        };
      }
      if (!response.ok) throw new Error("Research save failed.");
      return (await response.json()) as ResearchRecord;
    },
  }),
]);
