import { defineJudge } from "@gea-ai/agent-sdk/evals";

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
      assistantBetween(rain, revision, /358/),
    adjustment:
      assistantBetween(revision, confirmation, /轻旅24/) &&
      assistantBetween(
        revision,
        confirmation,
        /22.*(?:不|只有|仅)|(?:原|之前|先前).*?(?:容量|不|22)/s,
      ),
    finalFit:
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
