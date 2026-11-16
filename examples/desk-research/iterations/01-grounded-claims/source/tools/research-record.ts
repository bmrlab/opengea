import { defineTool, defineToolSet } from "@gea-ai/agent-sdk";
import { z } from "zod";
import { briefInput } from "../lib/research-brief.ts";
import { RESEARCH_OBJECT, type ResearchRecord } from "../lib/research";

export default defineToolSet([
  defineTool({
    name: "read_research",
    description: "读取当前对话的研究记录。新对话返回 null，不读取其他对话。",
    input: z.object({}),
    toModelOutput: ({ output }) => {
      // execute returns the store's ResearchRecord; omit excerpts already in report.
      const record = output as ResearchRecord | null;
      return {
        type: "json",
        value: record
          ? {
              id: record.id,
              title: record.title,
              scope: record.scope,
              status: record.status,
              report: record.report,
              sources: record.sources.map(
                ({ sourceId, quoteId, constraintEvidenceId, title, url }) => ({
                  sourceId,
                  quoteId,
                  constraintEvidenceId,
                  title,
                  url,
                }),
              ),
            }
          : null,
      };
    },
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
      "保存本对话的结构化研究简报。observations最多4条，选关键来源而非罗列全部搜索结果；逐个选择已捕获sourceId及该来源返回的quoteId（passageId）；系统取回原文并生成逐来源事实栏。fit/reasoning仅判断此来源案例对用户条件的适配，匹配/不匹配必须给constraintEvidenceId；跨案例机会放hypotheses（最多2个），basedOn引用observations序号（1开始），写验证和放弃条件。系统生成完整URL和report，最终答复使用返回的report。更新前先read_research；不保存凭据或隐私。",
    input: briefInput,
    toModelOutput: ({ output }) => ({
      type: "text",
      value:
        typeof output === "object" &&
        output !== null &&
        "report" in output &&
        typeof output.report === "string"
          ? `记录已保存。以下为最终交付的完整简报，请原样交付，不新增概括或依据。\n\n${output.report}`
          : JSON.stringify(output),
    }),
    execute: async (input, context) => {
      const response = await context.durableObjects.RESEARCH.getByName(
        RESEARCH_OBJECT,
      ).fetch(
        `https://research.internal/brief-record?id=${encodeURIComponent(context.identity.chat.id)}`,
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
          sourceId?: string;
        };
        return {
          saved: false,
          ...(rejection.sourceId ? { sourceId: rejection.sourceId } : {}),
          error: rejection.error,
          urls: rejection.urls ?? [],
          availableUrls: rejection.availableUrls ?? [],
          instruction:
            "记录尚未保存。核对sourceId和该来源返回的正文，quoteId/constraintEvidenceId须是该sourceId返回的passageId，不手抄摘录。正文缺失时read_source补读，仍无证据就保留缺口。不要猜原文、扩大范围或宣称保存成功。",
        };
      }
      if (!response.ok) throw new Error("Research save failed.");
      return (await response.json()) as ResearchRecord;
    },
  }),
]);
