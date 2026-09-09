export async function readContext(url, slug, chatId) {
  const response = await fetch(
    `${url}/gea/agents/${slug}/sessions/${encodeURIComponent(chatId)}/v1/model-context`,
  );
  if (!response.ok)
    throw new Error(
      `Context read failed (${response.status}): ${await response.text()}`,
    );
  return (await response.json()).context;
}
export async function runTurn(url, slug, chatId, message) {
  const started = performance.now();
  const response = await fetch(`${url}/gea/agents/${slug}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, message }),
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok)
    throw new Error(
      `Run failed (${response.status}): ${await response.text()}`,
    );
  const chunks = (await response.text())
    .split("\n")
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => JSON.parse(line.slice(6)));
  const error = chunks.find((chunk) => chunk.type === "error");
  const finish = chunks.findLast((chunk) => chunk.type === "finish");
  if (error || !finish || finish.finishReason === "error")
    throw new Error(
      `Run did not finish: ${JSON.stringify(error ?? finish ?? chunks.slice(-3))}`,
    );
  const modelCalls = finish.messageMetadata?.modelCalls;
  if (!modelCalls?.length)
    throw new Error(
      "Model-call usage is missing. Check the installed SDK and Runtime versions.",
    );
  return {
    text: chunks
      .filter((chunk) => chunk.type === "text-delta")
      .map((chunk) => chunk.delta)
      .join(""),
    elapsedMs: Math.round(performance.now() - started),
    modelCalls,
  };
}
