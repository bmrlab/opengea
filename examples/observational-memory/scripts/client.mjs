export async function readHistory(url, chatId) {
  const messages = [];
  let cursor;
  do {
    const response = await fetch(
      `${url}/sessions/${encodeURIComponent(chatId)}/messages?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    );
    if (!response.ok)
      throw new Error(
        `History read failed (${response.status}): ${await response.text()}`,
      );
    const page = await response.json();
    messages.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return messages;
}
export async function runTurn(url, slug, chatId, message) {
  const started = performance.now();
  const session = await fetch(`${url}/sessions/${chatId}`);
  if (session.status === 404) {
    const discovery = await fetch(`${url}/agents?environment=local`);
    if (!discovery.ok)
      throw new Error(`Agent discovery failed: ${discovery.status}`);
    const agent = (await discovery.json()).items.find(
      (agent) => agent.name === slug,
    );
    if (!agent) throw new Error(`Missing Agent: ${slug}`);
    const created = await fetch(`${url}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: chatId,
        agent_id: agent.id,
        environment: "local",
      }),
    });
    if (!created.ok)
      throw new Error(`Session creation failed: ${await created.text()}`);
  } else if (!session.ok)
    throw new Error(`Session read failed: ${session.status}`);
  const response = await fetch(`${url}/sessions/${chatId}/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: message, stream: true }),
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
