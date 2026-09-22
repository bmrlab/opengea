export async function relay(upstream: Response, completion?: Promise<unknown>) {
  const headers = new Headers({ "cache-control": "no-store" });
  for (const name of [
    "content-type",
    "x-vercel-ai-ui-message-stream",
    "x-gea-agent-session-id",
    "x-gea-agent-run-id",
    "x-gea-request-id",
    "retry-after",
  ]) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (!completion || !upstream.body) {
    await completion;
    return new Response(upstream.body, { status: upstream.status, headers });
  }
  // The Run reference is independent of its response bytes. Keep the request
  // alive until the write settles, including when the browser disconnects.
  const saveStartedAt = performance.now();
  const persisted = completion
    .then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    .then((result) => {
      console.info("oauth_app.run_reference", {
        requestId: upstream.headers.get("x-gea-request-id"),
        runId: upstream.headers.get("x-gea-agent-run-id"),
        saved: result.ok,
        elapsedMs: Math.round(performance.now() - saveStartedAt),
      });
      return result;
    });
  const reader = upstream.body.getReader();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          const saved = await persisted;
          if (!saved.ok) throw saved.error;
          if (!cancelled) {
            reader.releaseLock();
            controller.close();
          }
        } else if (!cancelled) controller.enqueue(value);
      } catch (error) {
        await persisted;
        if (!cancelled) {
          reader.releaseLock();
          controller.error(error);
        }
      }
    },
    async cancel(reason) {
      cancelled = true;
      try {
        await reader.cancel(reason);
      } finally {
        const saved = await persisted;
        reader.releaseLock();
        if (!saved.ok) throw saved.error;
      }
    },
  });
  return new Response(body, { status: upstream.status, headers });
}
