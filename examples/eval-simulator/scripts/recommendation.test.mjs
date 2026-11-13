import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import judge from "../benchmarks/judges/recommendation.judge.ts";

// Frozen verbatim dialogue from the old source runner, not a new model run.
// Keep this fixture independent of latest.md, which a future Eval overwrites.
const history = JSON.parse(
  await readFile(new URL("./fixtures/recommendation-history.json", import.meta.url), "utf8"),
);
const text = (message) => message.parts[0].text;
const setText = (message, value) => { message.parts[0].text = value; };
const appendFinal = (value) => (messages) =>
  setText(messages.at(-1), `${text(messages.at(-1))}\n${value}`);

const cases = [
  { name: "historical positive", score: 1 },
  {
    name: "positive: reject old product and retain waterproof caveat",
    score: 1,
    mutate: appendFinal("城行22不适合新的容量要求。轻旅24含防雨罩，无需另外加钱，但不是绝对防水。"),
  },
  {
    name: "price: replace every final 429 with 459",
    fails: "finalFit",
    mutate: (messages) => setText(messages.at(-1), text(messages.at(-1)).replaceAll("429", "459")),
  },
  {
    name: "budget: remove increase to 500",
    fails: "progressiveDisclosure",
    mutate: (messages) => setText(messages[8], text(messages[8]).replace("这样预算的话我可以提到500元左右", "预算仍然不超过350元")),
  },
  {
    name: "confirmation: remove final user and assistant",
    fails: "progressiveDisclosure",
    mutate: (messages) => messages.splice(-2),
  },
  {
    name: "review r1: negated initial recommendation and incorrect rain cost",
    fails: "initialRecommendation",
    mutate: (messages) => {
      setText(messages[5], "城行22不推荐。");
      setText(messages[7], "不是358元，总价应为399元。");
    },
  },
  {
    name: "review r1: contradictory final recommendation, total and accessory fee",
    fails: "finalFit",
    mutate: appendFinal("以上方案不适合你，最终不推荐轻旅24。实际总价499元，防雨罩需要另加钱。"),
  },
  ...["城行22不推荐。", "不推荐城行22。", "城行22不适合你。"].map((value) => ({
    name: `negation: initial ${value}`,
    fails: "initialRecommendation",
    mutate: (messages) => setText(messages[5], `${text(messages[5])}\n${value}`),
  })),
  ...["不是358元。", "实际总价399元。"].map((value) => ({
    name: `price: rain ${value}`,
    fails: "initialRecommendation",
    mutate: (messages) => setText(messages[7], `${text(messages[7])}\n${value}`),
  })),
  ...[
    "最终不推荐轻旅24。",
    "轻旅24不推荐。",
    "以上方案不适合你。",
    "实际总价499元。",
    "总价不是429元。",
    "防雨罩需要另加钱。",
    "防雨罩需要单独购买。",
    "报价不包含防雨罩。",
    "防雨罩不免费。",
  ].map((value) => ({
    name: `contradiction: final ${value}`,
    fails: "finalFit",
    mutate: appendFinal(value),
  })),
];

assert.equal(history.messages.length, 14);
for (const scenario of cases) {
  test(scenario.name, async (t) => {
    const messages = structuredClone(history.messages);
    scenario.mutate?.(messages);
    const result = await judge.evaluate({ messages, output: text(messages.at(-1)) });
    const { checks } = JSON.parse(result.reason);
    t.diagnostic(JSON.stringify({ score: result.score, checks }));
    if (scenario.score === 1) {
      assert.equal(result.score, 1);
      assert.ok(Object.values(checks).every(Boolean));
    } else {
      assert.notDeepEqual(messages, history.messages, "negative must change the dialogue");
      assert.ok(result.score >= 0 && result.score < 1, "negative must fail the minScore=1 gate");
      assert.equal(checks[scenario.fails], false);
    }
  });
}
