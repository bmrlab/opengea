import assert from "node:assert/strict";
import { z } from "zod";
const eventSchema = z.object({ type: z.string() }).passthrough();
const receiptSchema = z.object({
  sessionId: z.string().min(1),
  runId: z.string().min(1),
});
const rejectionSchema = z.object({
  error: z.literal("subagent_concurrency_limit"),
  limit: z.literal(2),
  active: z.literal(2),
  pendingRunIds: z.array(z.string()),
  pendingAdmissions: z.literal(0),
});
export function checkBatch(body, mode, jobs) {
  const events = body
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("data: ") && line !== "data: [DONE]")
    .map((line) => eventSchema.parse(JSON.parse(line.slice(6))));
  const failure = events.find(
    (e) => e.type === "error" || e.type === "tool-output-error",
  );
  assert.ok(!failure, JSON.stringify(failure));
  assert.equal(
    events.findLast((e) => e.type === "finish")?.finishReason,
    "stop",
  );
  const calls = events.filter(
    (e) => e.type === "tool-input-available" && e.toolName === "agent",
  );
  assert.equal(
    calls.length,
    jobs.length,
    "each job must be attempted exactly once",
  );
  const receipts = [],
    rejections = [];
  calls.forEach((call, i) => {
    assert.equal(call.input.target, "worker");
    assert.deepEqual(
      call.input.message,
      `HOLD label=${jobs[i].label} holdMs=${jobs[i].holdMs}`,
      "child input must match the requested job",
    );
    const outputs = events.filter(
      (e) =>
        e.type === "tool-output-available" && e.toolCallId === call.toolCallId,
    );
    assert.equal(outputs.length, 1);
    const output = outputs[0].output;
    if (output.error) {
      assert.equal(mode, "burst");
      rejections.push(rejectionSchema.parse(output));
    } else
      receipts.push({
        ...receiptSchema.parse(output),
        label: jobs[i].label,
        holdMs: jobs[i].holdMs,
      });
  });
  assert.equal(rejections.length, mode === "burst" ? 1 : 0);
  assert.equal(receipts.length, jobs.length - rejections.length);
  assert.equal(new Set(receipts.map((r) => r.runId)).size, receipts.length);
  assert.equal(new Set(receipts.map((r) => r.sessionId)).size, receipts.length);
  if (mode === "burst")
    assert.deepEqual(
      new Set(rejections[0].pendingRunIds),
      new Set(receipts.map((r) => r.runId)),
    );
  return { receipts, rejections };
}
