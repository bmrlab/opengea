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

  ...[
    "之前城行22加防雨罩的总价358元，现在轻旅24含防雨罩总价429元。",
    "总价不是499元，而是429元。",
    "城行22不适合，推荐轻旅24。",
    "防雨罩已包含，可按需购买电脑内胆袋。",
    "防雨罩不会另外收费。",
    "防雨罩不需要支付额外费用，无需额外购买。",
  ].map((value) => ({ name: `r2 positive: ${value}`, score: 1, mutate: appendFinal(value) })),
  {
    name: "r2 positive: separate base, accessory and total prices",
    score: 1,
    mutate: (messages) => setText(messages[7], `${text(messages[7])}城行22的价格是329元，防雨罩29元，含配件总价358元，比350元预算超出8元。`),
  },
  ...[
    "实际总价¥499。",
    "防雨罩需要另付29元。",
    "防雨罩\n需要另加钱。",
    "轻旅24不值得推荐。",
    "更正：轻旅24实际自重950g，超过800g限制。",
    "更正：最终颜色不是蓝色，是黑色。",
    "实际总价为人民币499元。",
    "实际总价499.00元。",
  ].map((value) => ({ name: `r2 negative: ${value}`, fails: "finalFit", mutate: appendFinal(value) })),
  {
    name: "r2 negative: reject budget increase while retaining 500",
    fails: "progressiveDisclosure",
    mutate: (messages) => setText(messages[8], text(messages[8]).replace("这样预算的话我可以提到500元左右", "预算不能提高到500元，仍然最多350元")),
  },
  {
    name: "r2 negative: incorrect initial base price and budget claim",
    fails: "initialRecommendation",
    mutate: (messages) => setText(messages[5], "初选城行22蓝色，价格399元，在350元预算内。"),
  },
  {
    name: "r2 negative: correct rain total but incorrect budget claim",
    fails: "initialRecommendation",
    mutate: (messages) => setText(messages[7], "城行22加防雨罩总价358元，完全在350元预算内，无须考虑超支。"),
  },
  {
    name: "r2 negative: reject correct rain quote and assert 399",
    fails: "initialRecommendation",
    mutate: (messages) => setText(messages[7], "358元是错误报价，您实际应付399元。"),
  },
  {
    name: "r2 negative: refuse adjustment before correct final reply",
    fails: "adjustment",
    mutate: (messages) => {
      setText(messages[9], "城行22只有22L，但轻旅24不推荐，还是城行22。");
      setText(messages[11], "继续选城行22。");
    },
  },
  ...[
    ["price", "总价499元，更正：总价不是499元，而是429元。"],
    ["weight", "轻旅24自重950g，更正：自重不是950g，是780g。"],
    ["color", "最终颜色黑色，更正：颜色不是黑色，是蓝色。"],
    ["cover", "防雨罩另付29元，更正：防雨罩已包含，不会另外收费。"],
    ["selection", "轻旅24不推荐，更正：推荐轻旅24。"],
  ].map(([attribute, value]) => ({ name: `ordered correction positive: ${attribute}`, score: 1, mutate: appendFinal(value) })),
  ...[
    ["price", "总价不是429元，而是499元。"],
    ["weight", "轻旅24自重不是780g，是950g。"],
    ["color", "最终颜色不是蓝色，而是黑色。"],
    ["cover", "防雨罩不会另外收费，更正：防雨罩另付29元。"],
    ["selection", "推荐轻旅24，更正：继续选城行22。"],
    ["capacity", "更正：轻旅24容量22L。"],
    ["computer", "更正：轻旅24电脑隔层最大支持13英寸。"],
  ].map(([attribute, value]) => ({ name: `ordered contradiction negative: ${attribute}`, fails: "finalFit", mutate: appendFinal(value) })),
  {
    name: "positive: explicit revised selection and rejection of old capacity",
    score: 1,
    mutate: (messages) => {
      setText(messages[9], "城行22只有22L，不够周末使用，推荐轻旅24。轻旅24容量24L，自重780g。");
      setText(messages[11], "继续选轻旅24，容量24L，自重780g。");
    },
  },
  {
    name: "positive: initial and rain price correction",
    score: 1,
    mutate: (messages) => {
      setText(messages[5], "初选城行22蓝色，价格不是399元，而是329元，在350元预算内。");
      setText(messages[7], "城行22加防雨罩总价不是399元，而是358元，比350元预算超出8元。");
    },
  },
  {
    name: "positive: explicit authorized budget correction",
    score: 1,
    mutate: (messages) => setText(messages[8], text(messages[8]).replace("这样预算的话我可以提到500元左右", "预算不是350元，而是500元")),
  },
  {
    name: "negative: later user revokes authorized budget",
    fails: "finalFit",
    mutate: (messages) => setText(messages[12], `${text(messages[12])}更正：预算仍然最多350元。`),
  },
  {
    name: "negative: adjustment later withdrawn",
    fails: "adjustment",
    mutate: (messages) => setText(messages[11], `${text(messages[11])}更正：继续选城行22。`),
  },

  ...[
    "防雨罩已包含，可按需购买电脑内胆袋29元。",
    "城行22自重850g，颜色黑色，总价358元。推荐轻旅24。",
    "轻旅24自重0.78kg，含防雨罩总价￥429.00。",
  ].map((value) => ({ name: `object binding positive: ${value}`, score: 1, mutate: appendFinal(value) })),
  {
    name: "negative: explicitly deny catalogue base price",
    fails: "finalFit",
    mutate: appendFinal("轻旅24价格不是429元。"),
  },
  {
    name: "negative: wrong base price in rain breakdown",
    fails: "initialRecommendation",
    mutate: (messages) => setText(messages[7], `${text(messages[7])}城行22的价格399元，防雨罩29元，含配件总价358元，比350元预算超出8元。`),
  },
  {
    name: "positive: rain compares base budget and accessory budget separately",
    score: 1,
    mutate: (messages) => setText(messages[7], "城行22加防雨罩总价358元，比350元预算超出8元。城行22裸价329元，在350元预算内。"),
  },
  {
    name: "negative: incorrect base budget claim",
    fails: "initialRecommendation",
    mutate: (messages) => setText(messages[5], "初选城行22蓝色，价格329元，超出350元预算。"),
  },
];

// Verbatim independent review r3 inputs; each starts from the same frozen history.
const r3 = JSON.parse(await readFile(new URL("./fixtures/recommendation-r3.json", import.meta.url), "utf8"));
assert.equal(r3.length, 51);
for (const scenario of r3) {
  cases.push({
    name: `r3 ${scenario.id}: ${scenario.text}`,
    score: scenario.positive ? 1 : ["B01", "B02", "B03"].includes(scenario.id) ? 2 / 3 : 5 / 6,
    fails: ["N15", "N16", "N18", "N19"].includes(scenario.id) ? "initialRecommendation"
      : ["N20", "N21"].includes(scenario.id) ? "adjustment"
      : ["B01", "B02", "B03"].includes(scenario.id) ? "progressiveDisclosure" : "finalFit",
    mutate: (messages) => {
      const original = text(messages[scenario.index]);
      setText(messages[scenario.index], scenario.operation === "追加"
        ? `${original}\n${scenario.text}`
        : scenario.operation === "预算短语替换"
          ? original.replace("这样预算的话我可以提到500元左右", scenario.text)
          : scenario.text);
    },
  });
}

// Compose independent grammar dimensions instead of adding sentence exceptions.
for (const separator of ["而是", "，而是", "，是"]) {
  for (const [property, correct, incorrect] of [
    ["总价", "429元", "499元"], ["自重", "780g", "950g"], ["颜色", "蓝色", "黑色"],
  ]) {
    for (const positive of [true, false]) {
      const value = `轻旅24${property}不是${positive ? incorrect : correct}${separator}${positive ? correct : incorrect}。`;
      cases.push({ name: `grammar correction ${value}`, ...(positive ? { score: 1 } : { fails: "finalFit" }), mutate: appendFinal(value) });
    }
  }
}
for (const format of [(n) => `${n}元`, (n) => `￥${n}`, (n) => `${n}块`, (n) => `¥${n}.00`]) {
  for (const separator of ["加", "，"]) {
    for (const positive of [true, false]) {
      const value = `城行22裸价${format(329)}${separator}防雨罩${format(29)}，总价${format(positive ? 358 : 359)}，超出350元预算。`;
      cases.push({ name: `grammar money roles ${value}`, ...(positive ? { score: 1 } : { fails: "initialRecommendation" }),
        mutate: (messages) => setText(messages[7], value) });
    }
  }
  for (const [prefix, suffix, positive] of [["现在可以提高到", "", true], ["不能接受提高到", "", false], ["提高到", "是不可能的", false]]) {
    const value = `预算先说350元，${prefix}${format(500)}${suffix}`;
    cases.push({ name: `grammar budget polarity ${value}`, ...(positive ? { score: 1 } : { fails: "progressiveDisclosure" }),
      mutate: (messages) => setText(messages[8], text(messages[8]).replace("这样预算的话我可以提到500元左右", value)) });
  }
}
for (const [index, product, fails] of [[5, "城行22", "initialRecommendation"], [7, "城行22", "initialRecommendation"], [11, "轻旅24", "adjustment"], [13, "轻旅24", "finalFit"]]) {
  for (const claim of ["容量18L", "自重960g", "不支持14英寸电脑"]) {
    cases.push({ name: `grammar stage contradiction m[${index}] ${product}${claim}`, fails,
      mutate: (messages) => setText(messages[index], `${text(messages[index])}更正：${product}${claim}。`) });
  }
}
for (const coordinator of ["或", "，或", "和", "，以及"]) {
  cases.push({ name: `grammar coordinated selection ${coordinator}`, fails: "finalFit",
    mutate: appendFinal(`最终推荐轻旅24${coordinator}城行22。`) });
}
for (const connector of ["但", "，但", "但是"]) {
  for (const positive of [true, false]) {
    for (const order of [true, false]) {
      const cover = positive ? "防雨罩无需购买" : "防雨罩需要另付29元";
      const other = "电脑内胆袋不需要买";
      const value = (order ? [cover, other] : [other, cover]).join(connector);
      cases.push({ name: `grammar accessory arguments ${value}`, ...(positive ? { score: 1 } : { fails: "finalFit" }), mutate: appendFinal(value) });
    }
  }
}

for (const [value, positive] of [
  ["您的轻旅24重780g。", true], ["您的轻旅24重950g。", false],
  ["轻旅24价格不是429元，也不是499元。", false],
  ["轻旅24价格不是429元，也不是499元，更正：价格429元。", true],
  ["轻旅24总价429元，并不在500元预算内。", false],
]) {
  cases.push({ name: `grammar retained constraints ${value}`, ...(positive ? { score: 1 } : { fails: "finalFit" }), mutate: appendFinal(value) });
}
for (const [value, positive] of [
  ["预算350元，电脑内胆袋500元", false],
  ["预算350元电脑内胆袋500元", false],
  ["预算提高到500元，电脑内胆袋29元", true],
  ["预算提高到500元电脑内胆袋29元", true],
]) {
  cases.push({ name: `grammar budget subject ${value}`, ...(positive ? { score: 1 } : { fails: "progressiveDisclosure" }),
    mutate: (messages) => setText(messages[8], text(messages[8]).replace("这样预算的话我可以提到500元左右", value)) });
}
cases.push({ name: "grammar negative within-budget claim for rain", score: 1,
  mutate: (messages) => setText(messages[7], "城行22加防雨罩总价358元，并不在350元预算内。") });
cases.push({ name: "grammar negative within-budget claim for initial", fails: "initialRecommendation",
  mutate: (messages) => setText(messages[5], "初选城行22蓝色，价格329元，并不在350元预算内。") });

cases.push({ name: "grammar priced cover included in rain package", score: 1,
  mutate: (messages) => setText(messages[7], "城行22裸价329元加防雨罩29元，总价358元，超出350元预算8元。防雨罩包含在此报价中。") });
cases.push({ name: "grammar free cover contradicts rain breakdown", fails: "initialRecommendation",
  mutate: (messages) => setText(messages[7], "城行22裸价329元加防雨罩29元，总价358元，超出350元预算8元。防雨罩免费。") });

for (const separator of ["", "，"]) {
  for (const positive of [true, false]) {
    const value = `城行22加防雨罩329+29=358元${separator}实际总价${positive ? 358 : 399}元，超出350元预算。`;
    cases.push({ name: `grammar arithmetic operand scope ${value}`, ...(positive ? { score: 1 } : { fails: "initialRecommendation" }),
      mutate: (messages) => setText(messages[7], value) });
  }
}

assert.equal(history.messages.length, 14);
for (const scenario of cases) {
  test(scenario.name, async (t) => {
    const messages = structuredClone(history.messages);
    scenario.mutate?.(messages);
    const result = await judge.evaluate({ messages, output: text(messages.at(-1)) });
    const { checks, authorizedBudget } = JSON.parse(result.reason);
    t.diagnostic(JSON.stringify({ name: scenario.name, score: result.score, authorizedBudget, checks }));
    if (scenario.score !== undefined) assert.equal(result.score, scenario.score);
    if (scenario.score === 1) {
      assert.equal(result.score, 1);
      assert.ok(Object.values(checks).every(Boolean));
    } else {
      assert.notDeepEqual(messages, history.messages, "negative must change the dialogue");
      assert.ok(result.score >= 0 && result.score < 1, "negative must fail the minScore=1 gate");
      if (scenario.fails) assert.equal(checks[scenario.fails], false);
    }
  });
}
