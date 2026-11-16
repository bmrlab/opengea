import { z } from "zod";
import {
  sourceIdInput,
  type CapturedReference,
  type ResearchInput,
} from "./research.ts";

// Facts have no free-form paraphrase field. Interpretation is attached to one
// cited case; broader opportunities have a separate, explicitly tentative form.
export const briefInput = z.strictObject({
  title: z.string().trim().min(1).max(200),
  scope: z
    .string()
    .trim()
    .min(1)
    .max(1500)
    .describe("本轮用户明确的人群、场景及限制；不是市场结论。"),
  status: z.enum(["researching", "complete"]),
  observations: z
    .array(
      z.strictObject({
        sourceId: sourceIdInput,
        quote: z
          .string()
          .trim()
          .min(8)
          .max(400)
          .describe(
            "逐字复制此sourceId实际返回的一段连续正文，不拼接、不加省略号；保留限定条件。",
          ),
        constraint: z
          .string()
          .trim()
          .min(1)
          .max(300)
          .describe("本题待对照的具体用户条件。"),
        fit: z.enum(["match", "mismatch", "unknown"]),
        constraintEvidence: z
          .string()
          .trim()
          .min(8)
          .max(400)
          .nullable()
          .describe(
            "能直接支持fit的同源连续原文。只知道价格、销量或商品名称不能推导使用条件；没有涉及用户条件的直接依据，填null且fit=unknown，不靠常识补齐。",
          ),
        reasoning: z
          .string()
          .trim()
          .min(1)
          .max(600)
          .describe(
            "仅说明此来源中的具体案例如何匹配/不匹配本题条件，或缺什么信息；不得改成品类、市场或人群的普遍判断。",
          ),
      }),
    )
    .max(8),
  hypotheses: z
    .array(
      z.strictObject({
        question: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe("待验证的机会问题；前提也不能预设未被证明的市场事实。"),
        basedOn: z.array(sourceIdInput).max(8),
        test: z
          .string()
          .trim()
          .min(1)
          .max(700)
          .describe("具体对象与验证动作。"),
        measure: z.string().trim().min(1).max(500),
        abandonIf: z.string().trim().min(1).max(500),
      }),
    )
    .max(4),
  gaps: z
    .array(z.string().trim().min(1).max(500))
    .max(8)
    .describe("本次证据尚未回答的问题，不把没有查到改写成市场不存在。"),
});
export type ResearchBrief = z.infer<typeof briefInput>;

const line = (text: string) =>
  text.replace(/\s+/gu, " ").replace(/[\\`*_[\]<>#|]/gu, "\\$&");
export function compileBrief(
  brief: ResearchBrief,
  catalog: Map<string, CapturedReference>,
):
  | { ok: true; record: ResearchInput }
  | { ok: false; error: string; sourceId: string } {
  const sources: ResearchInput["sources"] = [];
  const observations: string[] = [];
  for (const observation of brief.observations) {
    const source = catalog.get(observation.sourceId);
    if (!source)
      return {
        ok: false,
        error: "Uncaptured source identity",
        sourceId: observation.sourceId,
      };
    if (!source.passages?.some((text) => text.includes(observation.quote)))
      return {
        ok: false,
        error: "Quote is not present in captured text",
        sourceId: observation.sourceId,
      };
    if (observation.fit !== "unknown" && !observation.constraintEvidence)
      return {
        ok: false,
        error: "Fit verdict requires quoted constraint evidence",
        sourceId: observation.sourceId,
      };
    if (
      observation.constraintEvidence &&
      !source.passages?.some((text) =>
        text.includes(observation.constraintEvidence!),
      )
    )
      return {
        ok: false,
        error: "Constraint evidence is not present in captured text",
        sourceId: observation.sourceId,
      };
    sources.push({
      sourceId: source.sourceId,
      title: source.title || "Untitled source",
      url: source.url,
      excerpt: observation.quote,
    });
    const fit = { match: "匹配", mismatch: "不匹配", unknown: "未知" }[
      observation.fit
    ];
    observations.push(
      [
        `### 来源记录 ${observations.length + 1}：${line(source.title || "Untitled source")}`,
        `来源日期：${line(source.publishedAt || "未知")}；来源：${source.url}`,
        "原文摘录（该来源的表述，不等于独立核验或代表性结论）：",
        observation.quote
          .split(/\r?\n/u)
          .map((text) => `> ${text}`)
          .join("\n"),
        observation.constraintEvidence
          ? `条件依据（同源原文）：\n${observation.constraintEvidence
              .split(/\r?\n/u)
              .map((text) => `> ${text}`)
              .join("\n")}`
          : "条件依据：本来源未提供可引用的直接依据，适配性未知。",
        `仅对该来源案例的适配推断：针对“${line(observation.constraint)}”，${fit}。${line(observation.reasoning)}`,
      ].join("\n\n"),
    );
  }
  const hypotheses: string[] = [];
  for (const hypothesis of brief.hypotheses) {
    const links: string[] = [];
    for (const sourceId of hypothesis.basedOn) {
      if (!sources.some((source) => source.sourceId === sourceId))
        return {
          ok: false,
          error: "Hypothesis must refer to an observed source",
          sourceId,
        };
      links.push(catalog.get(sourceId)!.url);
    }
    hypotheses.push(
      [
        `### 待验证问题 ${hypotheses.length + 1}：${line(hypothesis.question)}`,
        ...(links.length
          ? [`启发来源（不证明问题成立）：${links.join("  ")}`]
          : []),
        `验证对象与动作：${line(hypothesis.test)}`,
        `观察指标：${line(hypothesis.measure)}`,
        `放弃条件：${line(hypothesis.abandonIf)}`,
      ].join("\n\n"),
    );
  }
  return {
    ok: true,
    record: {
      title: brief.title,
      scope: brief.scope,
      status: brief.status,
      sources,
      report: [
        `# ${line(brief.title)}`,
        `研究范围与用户条件：${line(brief.scope)}`,
        "## 逐来源记录与案例适配",
        ...observations,
        ...(observations.length
          ? []
          : ["没有取得可逐字核对的证据，不能形成事实发现。"]),
        "## 待验证机会",
        ...hypotheses,
        "## 本次证据缺口",
        ...brief.gaps.map((gap) => `- ${line(gap)}`),
      ].join("\n\n"),
    },
  };
}
