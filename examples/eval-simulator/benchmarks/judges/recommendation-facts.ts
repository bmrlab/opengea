// Finite assertion grammar for this fictional catalogue, not general Chinese NLP.
// Lexical predicates bind their own operands. Discourse context supplies omitted
// subjects, but never supplies negation: polarity belongs to one assertion only.
export const catalogue = {
  城行22: { price: 329, total: 358, coverFee: 29, capacity: 22, weight: 850, computer: 16 },
  轻旅24: { price: 429, total: 429, coverFee: 0, capacity: 24, weight: 780, computer: 14 },
  轻行18: { price: 249, total: 278, coverFee: 29, capacity: 18, weight: 650, computer: 14 },
  远足26: { price: 399, total: 438, coverFee: 39, capacity: 26, weight: 950, computer: 16 },
} as const;
type Product = keyof typeof catalogue;
export type Attribute = "price" | "total" | "coverFee" | "coverIncluded" | "weight" |
  "capacity" | "color" | "computer" | "recommend" | "priceOverBudget" | "totalOverBudget" | "capacityInsufficient";
type Value = string | number | boolean;
type Relation = "eq" | "ne" | "gt" | "ge" | "lt" | "le";
export type Fact = { product: Product; attribute: Attribute; value: Value; relation: Relation; evidence: string };
const productSource = "城行22|轻旅24|轻行18|远足26";
// Shared by product prices and user authorizations, including decimals/symbols.
const moneySource = "(?:[¥￥]\\d+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?(?:元|块))";
const amount = (text: string) => Number(text.replace(/[^\d.]/g, ""));
const normalize = (text: string) => text
  .replace(/[*_` \t"“”]/g, "").replace(/\r/g, "")
  .replace(/\n(?=\||[-•]|\d+[.、])/g, "；")
  .replace(/\|\n/g, "；").replace(/\n+/g, "").replace(/\|/g, ":");

// These are grammar boundaries, not character windows. Contrast starts a new
// positive predicate, including when a writer omits commas in 不是A而是B.
function clauses(text: string) {
  return normalize(text).replace(/[，,](?=或|和|以及)/g, "").split(/(?:[，,。！？；（）()]|而是|但是|但|(?:再次)?更正[:：])/).filter(Boolean);
}
const negation = /(?:不是|并非|不为|不等于|不再|不能|无法|不可以|不值得|不同意|不愿|不会|不需要|不必|不用|无需|无须|没有|并未|未|不)/;
function relation(prefix: string, suffix = ""): Relation {
  if (/^(?:是)?(?:错误报价|不对|不正确|有误)/.test(suffix)) return "ne";
  if (/不超过|至多|最多/.test(prefix)) return "le";
  if (/不少于|不低于|至少/.test(prefix)) return "ge";
  if (/超过|高于|大于/.test(prefix)) return "gt";
  if (/不足|不到|低于|小于/.test(prefix)) return "lt";
  return negation.test(prefix) ? "ne" : "eq";
}

// A token is either an entity, a predicate, or an operand. A new predicate
// closes the previous predicate's polarity and changes only its own value type.
const lexicon = [
  ["product", productSource],
  ["other", "(?:电脑)?(?:防水)?内胆袋|防护袋|内衬"],
  ["cover", "防雨罩|雨罩"],
  ["total", "含配件(?:的)?总价|总价|总共|总计|总额|合计|一共|到手|实际(?:应付|支付|需付)"],
  ["price", "价格|售价|裸价|单价"],
  ["budget", "预算"],
  ["weight", "自重|重量"],
  ["capacity", "容量"],
  ["color", "颜色"],
  ["computer", "电脑隔层|电脑适配|适配|支持|容纳|装下|够装"],
  ["selection", "建议(?:购买|选择)|值得(?:购买|推荐)|继续选|选定|初选|推荐|选择|不选|适合|合适|还是|剩下看|型号"],
  ["inclusion", "包含|包括|含在|已含|附送|赠送|免费|含(?=防雨罩)|不含|未含"],
  ["charge", "支付额外费用|付费|收费|加钱|加价|加购|购买|另付|另加|多加"],
  ["sum", "\\d+\\+\\d+=\\d+(?:元)?"],
  ["difference", "\\d+-\\d+=\\d+(?:元)?"],
  ["money", moneySource],
  ["dimension", "\\d+(?:\\.\\d+)?(?:kg|公斤|千克|g|克|[Ll升]|英寸|寸)"],
  ["shade", "蓝色|黑色|蓝(?!色)|黑(?!色)"],
] as const;
type Token = { kind: string; text: string; start: number; end: number };
const tokenPattern = new RegExp(lexicon.map(([kind, source]) => `(?<${kind}>${source})`).join("|"), "gi");
function tokens(text: string): Token[] {
  return [...text.matchAll(tokenPattern)].map((m) => ({
    kind: Object.keys(m.groups!).find((key) => m.groups![key] !== undefined)!,
    text: m[0], start: m.index!, end: m.index! + m[0].length,
  }));
}

export function extractFacts(text: string, defaultProduct: Product, defaultPrice: "price" | "total"): Fact[] {
  const facts: Fact[] = [];
  let topic = defaultProduct;
  let subject: "product" | "cover" | "other" = "product";
  let priceKind: "price" | "total" | "coverFee" = defaultPrice;
  let property: Attribute | undefined;
  const emit = (product: Product, attribute: Attribute, value: Value, rel: Relation, evidence: string) =>
    facts.push({ product, attribute, value, relation: rel, evidence });

  for (const clause of clauses(text)) {
    // Comparison operands and arithmetic differences have their own role; they
    // neither overwrite the proposal nor change the discourse topic.
    const comparisonAt = clause.search(/比(?!较)|相较/);
    const main = comparisonAt < 0 ? clause : clause.slice(0, comparisonAt);
    const comparison = comparisonAt < 0 ? "" : clause.slice(comparisonAt);
    const ts = tokens(main);
    const named = ts.filter((t) => t.kind === "product");
    const product = named.length ? named[0].text as Product : topic;
    if (named.length) {
      topic = named.at(-1)!.text as Product;
      subject = "product";
      priceKind = defaultPrice;
      property = undefined;
    }
    // Selection is a relation with all coordinated objects, not the first name.
    // A bare named specification is a proposal in this staged consultation.
    const selection = ts.find((t) => t.kind === "selection");
    if (selection && (named.length || /(?:以上|这个|该|此|最终)方案|这款包/.test(main))) {
      const prior = ts.filter((t) => t.end <= selection.start && t.kind !== "product").at(-1);
      const localPrefix = main.slice(prior?.end ?? 0, selection.start);
      const localSuffix = main.slice(selection.end);
      const rejected = negation.test(localPrefix + selection.text) || /^(?:不|并非)/.test(localSuffix);
      const objects = named.length ? named.map((t) => t.text as Product) : [product];
      for (const object of objects) emit(object, "recommend", !rejected, "eq", clause);
    } else if (named.length === 1 && new RegExp(`^(?:[-•]|\\d+[.、])?(?:${productSource})`).test(main) &&
      /^[:：]/.test(main.slice(named[0].end))) {
      emit(product, "recommend", true, "eq", clause);
    }
    if ((/容量|\d+[Ll升]/.test(main) || property === "capacity") && /不太够|不够|不足|只有|仅|没法满足/.test(main)) {
      emit(product, "capacityInsufficient", true, "eq", clause);
    }

    // Cursor marks the start of the current predicate, not the whole sentence.
    // Pending booleans are attached to the accessory entity even when it comes
    // after the predicate (含防雨罩 / 不包含防雨罩).
    let cursor = 0;
    let pending: { attribute: "coverFee" | "coverIncluded"; value: Value } | undefined;
    let activeProduct = product;
    let monetaryRole: "price" | "total" | "coverFee" | "budget" | "other" = subject === "other" ? "other" : priceKind;
    let explicitPrice = false;
    for (let i = 0; i < ts.length; i++) {
      const token = ts[i];
      const prefix = main.slice(cursor, token.start);
      const suffix = main.slice(token.end, ts[i + 1]?.start ?? main.length);
      if (token.kind === "product") {
        activeProduct = token.text as Product;
        // The subject does not end a preceding predicate (推荐轻旅24).
      } else if (token.kind === "other") {
        subject = "other";
        monetaryRole = "other";
        pending = undefined;
        cursor = token.end;
      } else if (token.kind === "cover") {
        subject = "cover";
        // An explicitly bound total survives its included accessory. Otherwise
        // the accessory owns its following fee, independently of the base price.
        if (!explicitPrice) monetaryRole = "coverFee";
        if (pending) {
          emit(activeProduct, pending.attribute, pending.value === "extra" ? 0 : pending.value, pending.value === "extra" ? "gt" : "eq", clause);
          pending = undefined;
        }
      } else if (["price", "total", "budget"].includes(token.kind)) {
        monetaryRole = token.kind as "price" | "total" | "budget";
        if (token.kind !== "budget") {
          priceKind = token.kind as "price" | "total";
          subject = "product";
          property = priceKind;
          explicitPrice = true;
        }
        cursor = token.start;
      } else if (["weight", "capacity", "color", "computer"].includes(token.kind)) {
        property = token.kind as Attribute;
        subject = "product";
        // Negation before a verbal predicate belongs to it (不支持14寸).
        cursor = negation.test(prefix) ? cursor : token.start;
      } else if (token.kind === "inclusion" || token.kind === "charge") {
        const negative = negation.test(prefix + token.text);
        const attr = token.kind === "inclusion" ? "coverIncluded" : "coverFee";
        const value = token.kind === "inclusion" ? !negative : negative ? 0 : "extra";
        // Resolve a predicate's explicit following object before falling back
        // to an omitted subject: 购买内胆袋 cannot charge a previous rain cover.
        const argument = ts[i + 1];
        const owner = argument?.kind === "other" ? "other"
          : argument?.kind === "cover" ? "cover" : subject;
        if (owner === "cover") {
          emit(activeProduct, attr, value === "extra" ? 0 : value, value === "extra" ? "gt" : "eq", clause);
          // Inclusion in a package does not make a priced component free.
          // Only an explicit free/no-charge assertion sets the fee to zero.
          if (attr === "coverFee" && value === 0) emit(activeProduct, "coverIncluded", true, "eq", clause);
          if (attr === "coverIncluded" && value === true && /免费|附送|赠送/.test(token.text)) {
            emit(activeProduct, "coverFee", 0, "eq", clause);
          }
        } else if (owner !== "other") pending = { attribute: attr, value };
        if (token.kind === "charge") monetaryRole = owner === "other" ? "other" : "coverFee";
        // Serial verbs with the same object share one polarity (无需加钱购买).
        if (ts[i - 1]?.kind !== token.kind) cursor = negation.test(prefix) ? cursor : token.start;
      } else if (token.kind === "sum" || token.kind === "difference") {
        if (token.kind === "sum") {
          const [base, fee, total] = token.text.match(/\d+/g)!.map(Number);
          const rel = relation(prefix);
          emit(activeProduct, "price", base, rel, clause);
          emit(activeProduct, "coverFee", fee, rel, clause);
          emit(activeProduct, "total", total, rel, clause);
          if (rel === "eq") emit(activeProduct, "coverIncluded", true, "eq", clause);
          priceKind = "total";
          monetaryRole = "total";
        }
        cursor = token.end;
        explicitPrice = false;
      } else if (token.kind === "money") {
        if (!(ts[i + 1]?.kind === "budget" && /^(?:的)?$/.test(suffix)) && monetaryRole !== "budget" && monetaryRole !== "other" &&
          !/预算|贵|省了|超出|超预算/.test(prefix) && !/^(?:的)?预算/.test(suffix)) {
          emit(activeProduct, monetaryRole, amount(token.text), relation(prefix, suffix), clause);
          property = monetaryRole;
          if (monetaryRole === "total" && ts.some((t) => t.kind === "cover") && /加|含/.test(main)) {
            emit(activeProduct, "coverIncluded", true, "eq", clause);
          }
        }
        cursor = token.end;
        explicitPrice = false;
      } else if (token.kind === "dimension" || token.kind === "shade") {
        const attr: Attribute = token.kind === "shade" ? "color" : /[Ll升]$/.test(token.text) ? "capacity"
          : /英寸|寸/.test(token.text) ? "computer" : "weight";
        const role = /(?:上限|限制|要求)/.test(suffix) || /从/.test(prefix) ||
          (/(?:希望|需要|容量要)/.test(prefix) && !/自重|实际|适配|支持|容纳|够装/.test(prefix));
        const optionalColors = attr === "color" && /可选|喜欢|需求/.test(main) && !/初选|推荐|最终/.test(main);
        if (!role && !optionalColors && (attr !== "computer" || /电脑|隔层|适配|支持|容纳|够装/.test(main))) {
          const value = attr === "color" ? `${token.text[0]}色` : amount(token.text) *
            (attr === "weight" && /kg|公斤|千克/i.test(token.text) ? 1000 : 1);
          emit(activeProduct, attr, value, relation(prefix, suffix), clause);
          property = attr;
        }
        cursor = token.end;
      }
    }
    // A budget comparison is a proposition distinct from either monetary
    // operand. Its polarity is checked against arithmetic in the stage scorer.
    const budgetClaim = main + comparison;
    if (/预算/.test(budgetClaim)) {
      const over = budgetClaim.match(/(?:超出|超过|超)(?:[^，。]*预算)?|超预算/);
      const within = budgetClaim.match(/在[^，。]*预算内|预算(?:内|以内)/);
      if (over || within) {
        const isOver = over ? !negation.test(budgetClaim.slice(0, over.index))
          : negation.test(budgetClaim.slice(0, within!.index));
        emit(product, priceKind === "price" ? "priceOverBudget" : "totalOverBudget", isOver, "eq", clause);
      }
    }
  }
  return facts;
}

function accepts(fact: Fact, value: Value) {
  switch (fact.relation) {
    case "eq": return value === fact.value;
    case "ne": return value !== fact.value;
    case "gt": return typeof value === "number" && value > Number(fact.value);
    case "ge": return typeof value === "number" && value >= Number(fact.value);
    case "lt": return typeof value === "number" && value < Number(fact.value);
    case "le": return typeof value === "number" && value <= Number(fact.value);
  }
}
export function factState(facts: Fact[]) {
  const state = new Map<string, Fact[]>();
  for (const fact of facts) {
    const key = `${fact.product}.${fact.attribute}`;
    const previous = state.get(key) ?? [];
    // A fresh positive assertion supersedes previous assertions. A negation
    // preserves compatible knowledge but records its own exclusion as well.
    state.set(key, fact.relation === "eq" ? [fact] : [...previous.filter((p) => p.relation !== "eq" || accepts(fact, p.value)), fact]);
  }
  // A later independent choice supersedes a prior choice; coordinated objects
  // share evidence and must all be considered. Rejection can empty the choice.
  let selected: Product | undefined;
  let choiceEvidence: string | undefined;
  const choices = new Set<Product>();
  for (const fact of facts.filter((f) => f.attribute === "recommend")) {
    if (fact.value === true) {
      if (choiceEvidence !== fact.evidence) choices.clear();
      choices.add(fact.product);
      choiceEvidence = fact.evidence;
    } else choices.delete(fact.product);
  }
  if (choices.size === 1) selected = [...choices][0];
  return {
    get: (product: Product, attribute: Attribute) => state.get(`${product}.${attribute}`)?.find((f) => f.relation === "eq")?.value,
    agrees: (product: Product, attribute: Attribute, value: Value) => (state.get(`${product}.${attribute}`) ?? []).every((f) => accepts(f, value)),
    computerFits: (product: Product, required: number, maximum: number) =>
      (state.get(`${product}.computer`) ?? []).every((f) => f.relation === "eq"
        ? typeof f.value === "number" && f.value >= required && f.value <= maximum
        : accepts(f, required) && accepts(f, maximum)),
    selected,
  };
}

// User budget is an authorization state, not a mention of a target amount.
// Revoking an increase rolls back to the original limit, never to the rejected
// amount. Only this function (never assistant facts) can authorize spending.
export function extractBudget(text: string, previous?: number, original?: number): number | undefined {
  let budget = previous;
  let context = false;
  for (const clause of clauses(text)) {
    const ts = tokens(clause);
    const anchor = ts.find((t) => t.kind === "budget");
    if (anchor) context = true;
    if (!context) continue;
    // An omitted budget subject is licensed by a change/limit predicate or a
    // bare correction operand. Other purchases cannot authorize this budget.
    const change = /提高|提到|增加|加到|最多|上限|仍然|改为|不算数|撤回|取消|不同意/;
    if (!anchor && !change.test(clause) && !new RegExp(`^(?:是)?${moneySource}$`).test(clause)) continue;
    const revoked = /不算数|撤回|取消|不同意/.test(clause);
    const denied = /不能|不可以|不考虑|不可能|不会|不愿|不想/.test(clause);
    if (revoked) { budget = original; continue; }
    if (denied) continue;
    let cursor = anchor?.start ?? 0;
    let owner = "budget";
    let consumed = false;
    for (const token of ts) {
      if (token.start < cursor) continue;
      if (["budget", "price", "total", "other", "cover", "computer"].includes(token.kind)) {
        owner = token.kind;
        consumed = false;
      }
      if (token.kind !== "money") continue;
      const prefix = clause.slice(cursor, token.start);
      if (owner === "budget" && (!consumed || change.test(prefix)) && relation(prefix) !== "ne") {
        budget = amount(token.text);
      }
      cursor = token.end;
      consumed = true;
    }
  }
  return budget;
}
