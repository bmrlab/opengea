import assert from "node:assert/strict";
import { z } from "zod";

const resultSchema = z.object({
  kind: z.literal("result"),
  label: z.string(),
  value: z.number().nullable(),
  marker: z.string().nullable(),
  agentId: z.string().min(1),
  sessionId: z.string().min(1),
  runId: z.string().min(1),
});
const summarySchema = z.object({
  kind: z.literal("summary"),
  batch: z.string(),
  runId: z.string(),
  sessionId: z.string(),
  results: z.array(
    z.object({
      label: z.string(),
      target: z.string(),
      runId: z.string(),
      sessionId: z.string(),
      status: z.string(),
      result: resultSchema
        .extend({ calculator: resultSchema.optional() })
        .nullable(),
      error: z.string().optional(),
    }),
  ),
});
const eventSchema = z.object({ type: z.string() }).passthrough();
const receiptSchema = z.object({
  runId: z.string().min(1),
  sessionId: z.string().min(1),
});

// AI SDK emits each JSON event on a single SSE data line.
export function parseRun(body) {
  const events = body
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => eventSchema.parse(JSON.parse(line.slice(6))));
  const failure = events.find(
    (event) => event.type === "error" || event.type === "tool-output-error",
  );
  if (failure) throw new Error(JSON.stringify(failure));
  const finish = events.findLast((event) => event.type === "finish");
  if (!finish || ["error", "length", "abort"].includes(finish.finishReason))
    throw new Error(`Invalid finish: ${JSON.stringify(finish)}`);
  const agentCalls = new Set(
    events
      .filter(
        (event) =>
          event.type === "tool-input-available" && event.toolName === "agent",
      )
      .map((event) => event.toolCallId),
  );
  const receipts = events.flatMap((event) => {
    if (
      event.type !== "tool-output-available" ||
      !agentCalls.has(event.toolCallId)
    )
      return [];
    const parsed = receiptSchema.safeParse(event.output);
    return parsed.success ? [parsed.data] : [];
  });
  return { events, receipts };
}

export function findSummary(messages, batch) {
  for (const message of [...messages].reverse()) {
    if (message.role !== "assistant") continue;
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
      .trim();
    // Models sometimes explain a failure before emitting the requested JSON.
    const candidates = [
      text,
      ...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gu),
    ].map((candidate) =>
      typeof candidate === "string" ? candidate : candidate[1],
    );
    for (const json of candidates) {
      let value;
      try {
        value = JSON.parse(json);
      } catch {
        continue;
      }
      if (value?.kind !== "summary" || value.batch !== batch) continue;
      return summarySchema.parse(value);
    }
  }
}

export function checkSummary(summary, jobs, receipts, parentSessionId) {
  assert.equal(
    summary.sessionId,
    parentSessionId,
    "summary must belong to the parent session",
  );
  assert.equal(
    summary.results.length,
    jobs.length,
    "every job must have a result",
  );
  assert.equal(
    receipts.length,
    jobs.length,
    "every job must have a run receipt",
  );
  assert.equal(
    new Set(receipts.map((receipt) => receipt.runId)).size,
    jobs.length,
    "run receipts must be unique",
  );
  const seenSessions = new Set([parentSessionId]);
  for (const job of jobs) {
    const row = summary.results.find((result) => result.label === job.label);
    assert.ok(row, `missing result for ${job.label}`);
    assert.equal(row.target, job.target ?? "self");
    assert.equal(
      row.status,
      "finished",
      `${job.label} must have completed: ${row.error ?? row.status}`,
    );
    assert.ok(row.result, `${job.label} is missing its result`);
    assert.ok(
      receipts.some(
        (receipt) =>
          receipt.runId === row.runId && receipt.sessionId === row.sessionId,
      ),
      "result must match a real receipt",
    );
    assert.equal(
      row.result.sessionId,
      row.sessionId,
      "child session must match receipt",
    );
    assert.equal(row.result.runId, row.runId, "child run must match receipt");
    assert.equal(row.result.value, job.value);
    assert.equal(row.result.marker, job.marker);
    assert.ok(
      !seenSessions.has(row.result.sessionId),
      "child must have an independent session identity",
    );
    seenSessions.add(row.result.sessionId);
    if (job.nested) {
      const calculator = row.result.calculator;
      assert.ok(
        calculator,
        "private researcher must return its calculator result",
      );
      assert.equal(calculator.value, job.value);
      assert.equal(calculator.marker, job.marker);
      assert.ok(
        !seenSessions.has(calculator.sessionId),
        "calculator must have another independent session",
      );
      seenSessions.add(calculator.sessionId);
    }
  }
}
