import assert from "node:assert/strict";
import test from "node:test";
import { briefInput, compileBrief } from "../lib/research-brief.ts";
const sourceId = "src_0123456789abcdef",
  passageId = "p_0123456789abcdef";
const text = "本款燕麦条需用60—80℃热水冲泡，其他产品请查各自说明。";
const catalog = new Map([
  [
    sourceId,
    {
      sourceId,
      url: "https://example.org/product",
      title: "一个具体产品",
      publishedAt: "2025-03-01",
      passageEntries: [{ passageId, text }],
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
      quoteId: passageId,
      constraint: "无热水",
      fit: "mismatch",
      constraintEvidenceId: passageId,
    },
  ],
  hypotheses: [
    {
      question: "常温直接可食的组合能否改善目标办公室的早餐体验？",
      basedOn: [1],
      test: "访问该办公室并对比现有早餐",
      measure: "记录携带、耗时与食用体验",
      abandonIf: "现有选择已满足使用者需求",
    },
  ],
  gaps: ["尚未核对其他品牌的食用说明和该办公室实际需求。"],
};
test("captured passage identities render verbatim facts and fit attached to one source", () => {
  const result = compileBrief(briefInput.parse(brief), catalog);
  assert.equal(result.ok, true);
  assert.match(result.record.report, /> 本款燕麦条需用60—80℃热水冲泡/);
  assert.match(result.record.report, /仅对该来源案例的适配推断/);
  assert.match(result.record.report, /待验证问题/);
  assert.deepEqual(result.record.sources, [
    {
      title: "一个具体产品",
      sourceId,
      url: "https://example.org/product",
      excerpt: text,
      quoteId: passageId,
      constraintEvidenceId: passageId,
    },
  ]);
});
test("unknown and cross-source passage identities cannot become saved facts", () => {
  const wrong = {
    ...brief,
    observations: [{ ...brief.observations[0], quoteId: "p_ffffffffffffffff" }],
  };
  assert.equal(compileBrief(wrong, catalog).ok, false);
  const crossSource = new Map([
    [sourceId, { ...catalog.get(sourceId), passageEntries: [] }],
    ["src_ffffffffffffffff", catalog.get(sourceId)],
  ]);
  assert.equal(compileBrief(brief, crossSource).ok, false);
  assert.equal(compileBrief(brief, new Map()).ok, false);
  assert.equal(
    compileBrief(
      {
        ...brief,
        hypotheses: [{ ...brief.hypotheses[0], basedOn: [2] }],
      },
      catalog,
    ).ok,
    false,
  );
});
test("free factual reports, paraphrases and hand-transcribed quotes are rejected by the input contract", () => {
  assert.equal(
    briefInput.safeParse({ ...brief, report: "整个品类需要热水" }).success,
    false,
  );
  for (const extra of [
    { summary: "市场通常都如此" },
    { reasoning: "把54%的早餐购买者改写成54%的早餐和零食购买者" },
    { quote: "所有免煮早餐均需热水" },
  ])
    assert.equal(
      briefInput.safeParse({
        ...brief,
        observations: [{ ...brief.observations[0], ...extra }],
      }).success,
      false,
    );
});
test("a captured fact alone cannot support a fit verdict without a constraint evidence passage", () => {
  const missing = compileBrief(
    {
      ...brief,
      observations: [{ ...brief.observations[0], constraintEvidenceId: null }],
    },
    catalog,
  );
  assert.equal(missing.ok, false);
  assert.equal(
    missing.error,
    "Fit verdict requires a constraint evidence passage",
  );
  assert.equal(
    compileBrief(
      {
        ...brief,
        observations: [
          {
            ...brief.observations[0],
            constraintEvidenceId: "p_ffffffffffffffff",
          },
        ],
      },
      catalog,
    ).ok,
    false,
  );
  const unknown = compileBrief(
    {
      ...brief,
      observations: [
        {
          ...brief.observations[0],
          fit: "unknown",
          constraintEvidenceId: null,
        },
      ],
    },
    catalog,
  );
  assert.equal(unknown.ok, true);
  assert.match(unknown.record.report, /条件依据：本来源未提供可引用的直接依据/);
});

test("hypothesis observation numbers resolve to that observation's captured URL", () => {
  const secondId = "src_ffffffffffffffff";
  const references = new Map(catalog);
  references.set(secondId, {
    ...catalog.get(sourceId),
    sourceId: secondId,
    url: "https://example.org/second",
  });
  const result = compileBrief(
    briefInput.parse({
      ...brief,
      observations: [
        ...brief.observations,
        { ...brief.observations[0], sourceId: secondId },
      ],
      hypotheses: [{ ...brief.hypotheses[0], basedOn: [2] }],
    }),
    references,
  );
  assert.equal(result.ok, true);
  const hypotheses = result.record.report.split("## 待验证机会")[1];
  assert.match(hypotheses, /https:\/\/example\.org\/second/);
  assert.doesNotMatch(hypotheses, /https:\/\/example\.org\/product/);
});
