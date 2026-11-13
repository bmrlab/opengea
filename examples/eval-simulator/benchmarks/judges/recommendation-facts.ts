// A deliberately bounded grammar for the fictional catalogue, not an NLP judge.
// Parsing emits ordered, object-bound assertions; scoring never searches raw text
// for a good number that could cancel a later contradictory assertion.
export const catalogue = {
  城行22: { price: 329, total: 358, coverFee: 29, capacity: 22, weight: 850 },
  轻旅24: { price: 429, total: 429, coverFee: 0, capacity: 24, weight: 780 },
  轻行18: { price: 249, total: 278, coverFee: 29, capacity: 18, weight: 650 },
  远足26: { price: 399, total: 438, coverFee: 39, capacity: 26, weight: 950 },
} as const;
type Product = keyof typeof catalogue;
type Attribute = "price" | "total" | "coverFee" | "coverIncluded" | "weight" |
  "capacity" | "color" | "computer" | "recommend" | "priceOverBudget" | "totalOverBudget" | "capacityInsufficient";
type Value = string | number | boolean;
export type Fact = { product: Product; attribute: Attribute; value: Value; affirmative: boolean; evidence: string };
const productPattern = /城行22|轻旅24|轻行18|远足26/g;
const negative = /(?:不是|并非|不为|不等于|不能|不可以|不愿|不再|不会|不需要|不必|不用|无需|无须|没有|未|不)/;
const normalize = (text: string) => text
  .replace(/[*_` \t"“”]/g, "")
  .replace(/\r/g, "")
  // Tables and list items are clause boundaries; other wraps are whitespace.
  .replace(/\n(?=\||[-•]|\d+[.、])/g, "；")
  .replace(/\|\n/g, "；")
  .replace(/\n+/g, "")
  .replace(/\|/g, ":");

export function extractFacts(text: string, defaultProduct: Product, defaultPrice: "price" | "total"): Fact[] {
  const facts: Fact[] = [];
  let product = defaultProduct;
  let priceKind: "price" | "total" | "coverFee" = defaultPrice;
  let subject: "product" | "cover" | "other" = "product";
  let property: Attribute | undefined;
  const emit = (attribute: Attribute, value: Value, affirmative: boolean, evidence: string) =>
    facts.push({ product, attribute, value, affirmative, evidence });

  for (const segment of normalize(text).split(/([。！？；])/)) {
    if (/^[。！？]$/.test(segment)) {
      product = defaultProduct;
      priceKind = defaultPrice;
      subject = "product";
      property = undefined;
      continue;
    }
    // A comma/parenthesis separates predicates, not a subject from its predicate.
    for (const clause of segment.split(/[，,（）()]/).filter(Boolean)) {
      const names = [...clause.matchAll(productPattern)];
      // Multiple named objects in one clause are processed in textual order.
      // Each slice ends at the next explicit object, never at a character window.
      if (names.length > 1) {
        for (let i = 0; i < names.length; i++) {
          const start = i === 0 ? 0 : names[i].index!;
          const end = names[i + 1]?.index ?? clause.length;
          facts.push(...extractFacts(clause.slice(start, end), product, priceKind === "coverFee" ? defaultPrice : priceKind));
        }
        product = names.at(-1)![0] as Product;
        continue;
      }
      if (names.length) {
        product = names[0][0] as Product;
        subject = "product";
        priceKind = defaultPrice;
        property = undefined;
      }
      if (/电脑.*(?:袋|内衬)|防护袋/.test(clause)) subject = "other";
      else if (/防雨罩/.test(clause)) subject = "cover";
      else if (/颜色|容量|自重|重量|型号|总价|售价|价格/.test(clause)) subject = "product";
      if (/总价|总共|总计|总额|合计|一共|到手|实际(?:应付|支付|需付)|含配件/.test(clause)) priceKind = "total";
      else if (/价格|售价|裸价|单价/.test(clause)) priceKind = "price";
      else if (names.length && /(?:加|\+)防雨罩/.test(clause)) priceKind = "total";
      else if (subject === "cover" && /加购|另付|另加|购买|多加\d|防雨罩\d/.test(clause)) priceKind = "coverFee";

      const recommendation = clause.match(/(?:推荐|适合|合适|建议(?:购买|选择)|选择|初选|继续选|还是|剩下看|型号|选定)/);
      if (recommendation && (names.length || /(?:以上|这个|该|此|最终)方案/.test(clause))) {
        const before = clause.slice(0, recommendation.index);
        const after = clause.slice(recommendation.index! + recommendation[0].length);
        const rejected = negative.test(before) || /^(?:不|并非)/.test(after);
        emit("recommend", !rejected, true, clause);
      }
      if ((/容量|22[Ll升]/.test(clause) || property === "capacity") && /不太够|不够|不足|只有|仅|没法满足/.test(clause)) {
        emit("capacityInsufficient", true, true, clause);
      }

      // Money tokens are classified by their predicate, never by distance to a
      // product name. Budget limits and arithmetic differences are not prices.
      const sum = clause.match(/(\d+)\+(\d+)=(\d+)(?:元)?/);
      if (sum) {
        emit("price", Number(sum[1]), true, clause);
        emit("coverFee", Number(sum[2]), true, clause);
        emit("total", Number(sum[3]), true, clause);
        priceKind = "total";
      } else if (subject !== "other" && !/\d+-\d+=/.test(clause)) {
        for (const money of clause.matchAll(/(?:[¥￥](\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)元)/g)) {
          const before = clause.slice(0, money.index);
          const after = clause.slice(money.index! + money[0].length);
          if (/预算|超出|超预算|贵|省了/.test(before) || /^(?:的)?预算/.test(after)) continue;
          const rejected = /(?:不是|并非|不为|不等于)[^\d]*$/.test(before) || /^(?:是)?(?:错误报价|不对|不正确|有误)/.test(after);
          emit(priceKind, Number(money[1] ?? money[2]), !rejected, clause);
          property = priceKind;
        }
      }

      if (subject === "cover") {
        const inclusion = clause.match(/包含|包括|含在|含防雨罩|附送|赠送|免费|不含|未含/);
        if (inclusion) {
          const excluded = /不含|未含|不包含|未包含|不包括|不免费/.test(clause);
          emit("coverIncluded", !excluded, true, clause);
          if (!excluded) emit("coverFee", 0, true, clause);
        }
        const charge = clause.match(/支付额外费用|付费|收费|加钱|加价|加购|购买|另付|另加钱/);
        if (charge) {
          const free = negative.test(clause.slice(0, charge.index));
          // A positive unspecified fee is still a nonzero fee assertion.
          const amount = clause.match(/(\d+(?:\.\d+)?)元/);
          emit("coverFee", free ? 0 : amount ? Number(amount[1]) : "extra", true, clause);
          if (free) emit("coverIncluded", true, true, clause);
        }
      }

      for (const [attribute, pattern] of [
        ["weight", /(\d+(?:\.\d+)?)(kg|公斤|千克|g|克)/gi],
        ["capacity", /(\d+(?:\.\d+)?)[Ll升]/g],
        ["computer", /(\d+)(?:英寸|寸)/g],
        ["color", /(蓝色|黑色)/g],
      ] as const) {
        for (const match of clause.matchAll(pattern)) {
          const before = clause.slice(0, match.index);
          const after = clause.slice(match.index! + match[0].length);
          // Limits, comparisons and user possessions are not product specs.
          if (/低于|超过|不超过|至少|上限|限制|从|您|你的/.test(before) || /^(?:的)?(?:上限|限制|要求)/.test(after)) continue;
          if (attribute === "computer" && !/电脑|隔层|适配|支持/.test(clause)) continue;
          if (attribute === "color" && /可选|喜欢|需求/.test(clause) && !/初选|推荐|最终|颜色/.test(clause)) continue;
          const rejected = /(?:不是|并非|不为)[^，,]*$/.test(before);
          const value = attribute === "color" ? match[1] : Number(match[1]) *
            (attribute === "weight" && /kg|公斤|千克/i.test(match[2]) ? 1000 : 1);
          emit(attribute, value, !rejected, clause);
          property = attribute;
        }
      }
      if (/预算/.test(clause)) {
        if (/超出|超预算|超.*预算|预算.*超出/.test(clause)) emit(priceKind === "price" ? "priceOverBudget" : "totalOverBudget", true, true, clause);
        else if (/预算(?:内|以内)|在.*预算内/.test(clause)) emit(priceKind === "price" ? "priceOverBudget" : "totalOverBudget", false, true, clause);
      }
      // A comparison names the alternative only for this clause; the following
      // unqualified assertions still describe the current proposal.
      if (/^比/.test(clause)) {
        product = defaultProduct;
        priceKind = defaultPrice;
        subject = "product";
        property = undefined;
      }
    }
  }
  return facts;
}

export function factState(facts: Fact[]) {
  const state = new Map<string, Value>();
  let selected: Product | undefined;
  const denied = new Map<string, Set<Value>>();
  for (const fact of facts) {
    const key = `${fact.product}.${fact.attribute}`;
    if (fact.affirmative) {
      state.set(key, fact.value);
      denied.delete(key);
    } else {
      if (state.get(key) === fact.value) state.delete(key);
      const values = denied.get(key) ?? new Set<Value>();
      values.add(fact.value);
      denied.set(key, values);
    }
    if (fact.attribute === "recommend" && fact.affirmative) {
      if (fact.value === true) selected = fact.product;
      else if (selected === fact.product) selected = undefined;
    }
  }
  return {
    get: (product: Product, attribute: Attribute) => state.get(`${product}.${attribute}`),
    denies: (product: Product, attribute: Attribute, value: Value) => denied.get(`${product}.${attribute}`)?.has(value) ?? false,
    selected,
  };
}

// Only user statements can authorize a budget. A rejected target ("不能提高到
// 500") never becomes a limit; a following "仍然最多350" can update it.
export function extractBudget(text: string): number | undefined {
  let budget: number | undefined;
  let context = false;
  for (const clause of normalize(text).split(/[，,。！？；]/)) {
    if (/预算/.test(clause)) context = true;
    if (!context) continue;
    for (const match of clause.matchAll(/(\d+(?:\.\d+)?)元/g)) {
      const before = clause.slice(0, match.index);
      if (/(?:不能|不可以|不会|不愿|不想|不)(?:再)?(?:提高|提到|提高到|增加|加到)|不是|并非/.test(before)) continue;
      if (/预算|最多|仍然|改为|而是/.test(before)) budget = Number(match[1]);
    }
  }
  return budget;
}
