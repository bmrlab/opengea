import { defineJudge } from "@gea-ai/agent-sdk/evals";

export default defineJudge(({ messages, output }) => {
  const users = messages.filter((message) => message.role === "user");
  const assistants = messages.filter((message) => message.role === "assistant");
  const text = (message: (typeof messages)[number]) =>
    message.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("");
  const asked =
    assistants[0] &&
    /蓝|红|颜色/.test(text(assistants[0])) &&
    /[？?]/.test(text(assistants[0]));
  const answered = users
    .slice(1)
    .some((message) => text(message).includes("蓝"));
  const recommended =
    /蓝/.test(output) && /背包/.test(output) && /199\s*元/.test(output);
  return {
    score: asked && answered && recommended ? 1 : 0,
    reason: `追问颜色=${Boolean(asked)}；模拟用户回答蓝色=${answered}；最终推荐蓝色背包并报价199元=${recommended}；对话=${users.length}次用户输入/${assistants.length}次助手回复。`,
  };
});
