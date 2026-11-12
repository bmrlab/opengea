import { createCatalogLanguageModel } from "@gea-ai/agent-sdk/catalog-language-model";

// Real provider transport for this source-only example. No canned model replies.
// The Eval runner and tool-free Simulator Worker still own conversation/decisions.
export function modelRequest(apiKey) {
  const model = createCatalogLanguageModel({
    format: "anthropic-messages",
    modelId: "creative-reasoning-1.5",
    baseURL: "https://api.creative-reasoning.com/v1",
    apiKey,
    auth: "bearer",
    fetch: globalThis.fetch,
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
      console.log(
        "Simulator request:",
        JSON.stringify({ tools, toolChoice: request.options.toolChoice }),
      );
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
