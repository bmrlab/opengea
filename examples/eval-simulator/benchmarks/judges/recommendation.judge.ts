import { defineJudge } from "@gea-ai/agent-sdk/evals";
import {
  catalogue,
  extractBudget,
  extractFacts,
  factState,
} from "./recommendation-facts.ts";

// Only the Judge owns these acceptance checks. The Simulator receives neither
// this file nor a target product, transcript, score, or expected answer.
export default defineJudge(({ messages, output }) => {
  const dialogue = messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant",
    )
    .map((message) => ({
      role: message.role,
      text: message.parts
        .flatMap((part) => (part.type === "text" ? [part.text] : []))
        .join(""),
    }));
  const users = dialogue.filter((message) => message.role === "user");
  const assistants = dialogue.filter((message) => message.role === "assistant");
  const userIndex = (test: (text: string) => boolean) =>
    dialogue.findIndex(
      (message) => message.role === "user" && test(message.text),
    );
  const equipment = userIndex((text) => /14/.test(text) && /电脑/.test(text));
  const budget = userIndex((text) => /350/.test(text) && /蓝/.test(text));
  const rain = userIndex((text) => /雨/.test(text) && /骑/.test(text));
  const revision = userIndex(
    (text) => /24/.test(text) && /周末|过夜|一晚/.test(text),
  );
  const weight = userIndex(
    (text) => /800|0[.]8/.test(text) && /肩|重|轻/.test(text),
  );
  const confirmation = dialogue.findIndex(
    (message, index) =>
      index > weight &&
      message.role === "user" &&
      /雨罩/.test(message.text) &&
      /包含|含在|包括|算进|算在|计入|另外|额外|单独|加价/.test(message.text) &&
      /总|一共|多少/.test(message.text),
  );
  const assistantBetween = (start: number, end: number, pattern: RegExp) =>
    start >= 0 &&
    end > start &&
    dialogue
      .slice(start + 1, end)
      .some(
        (message) => message.role === "assistant" && pattern.test(message.text),
      );
  const stageFacts = (
    start: number,
    end: number,
    product: "城行22" | "轻旅24",
    price: "price" | "total",
  ) => start >= 0 && end > start
    ? dialogue.slice(start + 1, end)
        .filter((message) => message.role === "assistant")
        .flatMap((message) => extractFacts(message.text, product, price))
    : [];
  // Each phase has its own state: a correct final answer cannot repair a
  // missing/negated adjustment before the user's confirmation.
  const initialFacts = stageFacts(budget, rain, "城行22", "price");
  const rainFacts = stageFacts(rain, revision, "城行22", "total");
  const adjustmentFacts = stageFacts(revision, confirmation, "轻旅24", "total");
  const finalFacts = extractFacts(output, "轻旅24", "total");
  const initial = factState(initialFacts);
  const rainState = factState(rainFacts);
  const adjusted = factState(adjustmentFacts);
  const final = factState(finalFacts);
  const initialBudget = budget >= 0 ? extractBudget(dialogue[budget].text) : undefined;
  let authorizedBudget = initialBudget;
  for (const message of users) authorizedBudget = extractBudget(message.text) ?? authorizedBudget;
  const matchesIfStated = (
    state: ReturnType<typeof factState>,
    product: "城行22" | "轻旅24",
    attribute: "price" | "coverFee" | "priceOverBudget",
    expected: number | boolean,
  ) =>
    !state.denies(product, attribute, expected) &&
    (state.get(product, attribute) === undefined || state.get(product, attribute) === expected);
  const old = catalogue.城行22;
  const target = catalogue.轻旅24;
  const checks = {
    // Length alone cannot pass: separate disclosures and reactions are required.
    conversation: users.length >= 5 && assistants.length === users.length,
    clarification:
      equipment > 0 &&
      budget > equipment &&
      assistantBetween(0, equipment, /[？?]/) &&
      assistantBetween(equipment, budget, /预算.*[？?]|[？?].*预算/s),
    progressiveDisclosure:
      rain > budget &&
      revision > rain &&
      extractBudget(dialogue[revision].text) === 500 &&
      weight > revision &&
      confirmation > weight,
    initialRecommendation:
      initial.selected === "城行22" &&
      initial.get("城行22", "price") === old.price &&
      initialBudget !== undefined && old.price <= initialBudget &&
      rainState.get("城行22", "total") === old.total &&
      rainState.get("城行22", "totalOverBudget") === (old.total > initialBudget) &&
      matchesIfStated(initial, "城行22", "priceOverBudget", false) &&
      matchesIfStated(rainState, "城行22", "price", old.price) &&
      matchesIfStated(rainState, "城行22", "coverFee", old.coverFee),
    adjustment:
      adjusted.selected === "轻旅24" &&
      adjusted.get("城行22", "capacityInsufficient") === true &&
      adjusted.get("轻旅24", "capacity") === target.capacity &&
      adjusted.get("轻旅24", "weight") === target.weight,
    finalFit:
      confirmation > weight && weight > revision && revision > rain &&
      final.selected === "轻旅24" &&
      final.get("轻旅24", "color") === "蓝色" &&
      final.get("轻旅24", "capacity") === target.capacity &&
      final.get("轻旅24", "weight") === target.weight &&
      final.get("轻旅24", "computer") === 14 &&
      final.get("轻旅24", "coverIncluded") === true &&
      final.get("轻旅24", "coverFee") === 0 &&
      final.get("轻旅24", "total") === target.total &&
      matchesIfStated(final, "轻旅24", "price", target.price) &&
      authorizedBudget !== undefined && target.total <= authorizedBudget,
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    score: passed / Object.keys(checks).length,
    reason: JSON.stringify({
      checks,
      authorizedBudget,
      userTurns: users.length,
      assistantTurns: assistants.length,
    }),
  };
});
