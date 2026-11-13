import { createCatalogLanguageModel } from "@gea-ai/agent-sdk/catalog-language-model";

// Real provider transport for this source-only example. No canned model replies.
// The Eval runner and tool-free Simulator Worker still own conversation/decisions.
export function modelRequest(apiKey, onSimulatorRequest = () => {}) {
  const model = createCatalogLanguageModel({
    format: "anthropic-messages",
    modelId: "creative-reasoning-1.5",
    baseURL: "https://api.creative-reasoning.com/v1",
    apiKey,
    auth: "bearer",
    // Keep the Simulator's fixed 1024-token budget for its JSON decision.
    // Provider-side thinking can otherwise consume that entire budget.
    requestBody: { thinking: { type: "disabled" } },
    fetch: async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.thinking?.type !== "disabled")
        throw new Error(
          "This example requires provider thinking to be disabled",
        );
      console.log(
        "Model transport:",
        JSON.stringify({
          thinking: body.thinking.type,
          maxOutputTokens: body.max_tokens,
        }),
      );
      return globalThis.fetch(url, init);
    },
  });
  return async ({ body, endpoint, signal }) => {
    if (endpoint !== "stream")
      throw new Error(`Unsupported model endpoint: ${endpoint}`);
    const request = JSON.parse(body);
    if (request.model !== "creative-reasoning-1.5")
      throw new Error("Unexpected model");
    if (
      JSON.stringify(request.options.prompt[0]).includes("You simulate a user")
    ) {
      const tools = request.options.tools ?? [];
      if (tools.length || request.options.toolChoice?.type !== "none") {
        throw new Error("Simulator must have zero tools and toolChoice=none");
      }
      const userPrompt = request.options.prompt.find(
        (message) => message.role === "user",
      );
      const content = userPrompt?.content;
      const input = JSON.parse(
        typeof content === "string"
          ? content
          : content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join(""),
      );
      const inputKeys = Object.keys(input).sort();
      if (inputKeys.join(",") !== "goal,messages,persona")
        throw new Error(
          "Simulator input must contain only persona, goal and messages",
        );
      if (
        !Array.isArray(input.messages) ||
        input.messages.some(
          (message) =>
            Object.keys(message).sort().join(",") !== "content,role" ||
            !["user", "assistant"].includes(message.role),
        )
      )
        throw new Error("Simulator must receive only visible conversation");
      const receipt = {
        tools,
        toolChoice: request.options.toolChoice,
        inputKeys,
        visibleMessageCount: input.messages.length,
      };
      onSimulatorRequest(receipt);
      console.log("Simulator request:", JSON.stringify(receipt));
    }
    const result = await model.doStream({
      ...request.options,
      abortSignal: signal,
    });
    return new Response(
      result.stream.pipeThrough(
        new TransformStream({
          transform(part, controller) {
            controller.enqueue(
              new TextEncoder().encode(JSON.stringify(part) + "\n"),
            );
          },
        }),
      ),
      { headers: { "content-type": "application/x-ndjson" } },
    );
  };
}
