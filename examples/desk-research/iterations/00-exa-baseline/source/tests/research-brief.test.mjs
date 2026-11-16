import assert from "node:assert/strict";
import test from "node:test";
import { briefInput, compileBrief } from "../lib/research-brief.ts";

const sourceId = "src_0123456789abcdef";
const catalog = new Map([
  [
    sourceId,
    {
      sourceId,
      url: "https://example.org/product",
      title: "一个具体产品",
      publishedAt: "2025-03-01",
      passages: ["本款燕麦条需用60—80℃热水冲泡，其他产品请查各自说明。"],
    },
  ],
]);
const brief = {
  title: "办公室早餐",
  scope: "无热水、无加热设备",
  status: "complete",
  observations: [
    {
      sourceId,
      quote: "本款燕麦条需用60—80℃热水冲泡",
      constraint: "无热水",
      fit: "mismatch",
      reasoning: "该产品的冲泡条件与本题不匹配。",
    },
  ],
  hypotheses: [
    {
      question: "常温直接可食的组合能否改善目标办公室的早餐体验？",
      basedOn: [sourceId],
      test: "访问该办公室并对比现有早餐",
      measure: "记录携带、耗时与食用体验",
      abandonIf: "现有选择已满足使用者需求",
    },
  ],
  gaps: ["尚未核对其他品牌的食用说明和该办公室实际需求。"],
};

test("brief keeps verbatim facts and inferred fit attached to one captured source", () => {
  const result = compileBrief(briefInput.parse(brief), catalog);
  assert.equal(result.ok, true);
  assert.match(result.record.report, /> 本款燕麦条需用60—80℃热水冲泡/);
  assert.match(result.record.report, /仅对该来源案例的适配推断/);
  assert.match(result.record.report, /待验证问题/);
  assert.match(result.record.report, /https:\/\/example.org\/product/);
  assert.deepEqual(result.record.sources, [
    {
      title: "一个具体产品",
      sourceId,
      url: "https://example.org/product",
      excerpt: brief.observations[0].quote,
    },
  ]);
});

test("fabricated, cross-source and unseen quotes cannot be saved as facts", () => {
  for (const quote of [
    "所有免煮早餐均需要热水",
    "本款燕麦条需用热水冲泡",
    "其他来源的真实原文",
  ]) {
    const result = compileBrief(
      { ...brief, observations: [{ ...brief.observations[0], quote }] },
      catalog,
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, "Quote is not present in captured text");
  }
  assert.equal(compileBrief(brief, new Map()).ok, false);
  assert.equal(
    compileBrief(
      {
        ...brief,
        hypotheses: [
          { ...brief.hypotheses[0], basedOn: ["src_ffffffffffffffff"] },
        ],
      },
      catalog,
    ).ok,
    false,
  );
});

test("free factual report fields are not accepted alongside the structured brief", () => {
  assert.equal(
    briefInput.safeParse({ ...brief, report: "整个品类需要热水" }).success,
    false,
  );
  assert.equal(
    briefInput.safeParse({
      ...brief,
      observations: [{ ...brief.observations[0], summary: "市场通常都如此" }],
    }).success,
    false,
  );
});
