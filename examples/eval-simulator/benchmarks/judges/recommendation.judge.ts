import { defineJudge } from "@gea-ai/agent-sdk/evals";

// Small, conservative rules for this catalogue, not a general language judge.
// Strip Markdown emphasis so it cannot split a negative or a price assertion.
const plain = (text: string) => text.replace(/[*_` \t]/g, "");
const rejectsRecommendation = (text: string, product: string) => {
  const negative =
    "(?:不(?:再|太)?推荐|不(?:太)?适合|不(?:太)?合适|不建议(?:购买|选择)?|不能选)";
  return (
    new RegExp(
      `${negative}[^。！？；\\n]{0,12}${product}|${product}[^。！？；\\n]{0,24}${negative}`,
    ).test(text) ||
    /(?:以上|这个|该|此|最终)?方案[^。！？；\n]{0,12}(?:不适合|不合适|不推荐)/.test(text)
  );
};
const conflictsWithPrice = (text: string, expected: number) => {
  // Check every stated total, not just whether one correct number is present.
  const totals = text.matchAll(
    /(?:总价|总共|总计|总额|合计|一共|到手|实际(?:价格|售价|支付|需付)?|价格|售价)[^\d。！？；\n]{0,16}(\d+(?:[.]\d+)?)元/g,
  );
  return (
    [...totals].some((match) => Number(match[1]) !== expected) ||
    new RegExp(
      `(?:不是|并非|不为|不等于)${expected}元|${expected}元(?:不对|不正确|有误)`,
    ).test(text)
  );
};
const chargesForCover = (text: string) =>
  text.split(/[。！？；\n]/).some((sentence) => {
    if (!/防雨罩/.test(sentence)) return false;
    // Preserve legitimate "不需要另外再加钱" and "无需加购" statements.
    const charge = sentence.replace(
      /(?:不需要|不用|不必|不要|不|无需|无须|没有)(?:另外|额外|单独|另|再)*(?:付费|收费|加钱|加价|加购|购买)(?:购买)?/g,
      "",
    );
    return /不含|未含|不包含|未包含|不包括|不免费|付费|收费|加钱|加价|加购|购买/.test(
      charge,
    );
  });

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
    (text) =>
      /500/.test(text) && /24/.test(text) && /周末|过夜|一晚/.test(text),
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
  const initialReplies = dialogue
    .slice(budget + 1, rain)
    .filter((message) => message.role === "assistant")
    .map((message) => plain(message.text));
  const rainReplies = dialogue
    .slice(rain + 1, revision)
    .filter((message) => message.role === "assistant")
    .map((message) => plain(message.text));
  const final = plain(output);
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
      weight > revision &&
      confirmation > weight,
    initialRecommendation:
      assistantBetween(budget, rain, /城行22/) &&
      assistantBetween(rain, revision, /358\s*元/) &&
      !initialReplies.some((text) => rejectsRecommendation(text, "城行22")) &&
      !rainReplies.some((text) => conflictsWithPrice(text, 358)),
    adjustment:
      assistantBetween(revision, confirmation, /轻旅24/) &&
      assistantBetween(
        revision,
        confirmation,
        /22.*(?:不|只有|仅)|(?:原|之前|先前).*?(?:容量|不|22)/s,
      ),
    finalFit:
      !rejectsRecommendation(final, "轻旅24") &&
      !conflictsWithPrice(final, 429) &&
      !chargesForCover(final) &&
      /轻旅24/.test(output) &&
      /蓝/.test(output) &&
      /24\s*[Ll升]/.test(output) &&
      /780\s*(?:g|克)|0[.]78\s*(?:kg|公斤|千克)/i.test(output) &&
      /14/.test(output) &&
      /电脑/.test(output) &&
      /(?:含|附送|赠送)[^。\n]*防雨罩|防雨罩[^。\n]*(?:包含|含在|免费|无需|不另|不加)/.test(
        output,
      ) &&
      /(?:总|合计|一共|到手)[^。\n]*429\s*元/.test(output),
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    score: passed / Object.keys(checks).length,
    reason: JSON.stringify({
      checks,
      userTurns: users.length,
      assistantTurns: assistants.length,
    }),
  };
});
