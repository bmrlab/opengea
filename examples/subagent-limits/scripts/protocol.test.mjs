import { test } from "node:test";
import assert from "node:assert/strict";
import { checkBatch } from "./protocol.mjs";
const stream = (events) =>
  events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
const events = (outputs) =>
  outputs
    .flatMap((output, i) => [
      {
        type: "tool-input-available",
        toolName: "agent",
        toolCallId: String(i),
        input: {
          target: "worker",
          message: `HOLD label=job-${i} holdMs=0`,
        },
      },
      { type: "tool-output-available", toolCallId: String(i), output },
    ])
    .concat({ type: "finish", finishReason: "stop" });
const receipts = [
  { sessionId: "s1", runId: "r1" },
  { sessionId: "s2", runId: "r2" },
];
const rejection = {
  error: "subagent_concurrency_limit",
  limit: 2,
  active: 2,
  pendingRunIds: ["r1", "r2"],
  pendingAdmissions: 0,
};
const jobs = [0, 1, 2].map((i) => ({ label: `job-${i}`, holdMs: 0 }));
test("burst requires real capacity error and exactly two accepted children", () => {
  assert.equal(
    checkBatch(stream(events([...receipts, rejection])), "burst", jobs).receipts
      .length,
    2,
  );
  assert.throws(() => checkBatch(stream(events(receipts)), "burst", jobs));
  assert.throws(() =>
    checkBatch(
      stream(events([...receipts, { ...rejection, active: 1 }])),
      "burst",
      jobs,
    ),
  );
  assert.throws(() =>
    checkBatch(
      stream(events([...receipts, { sessionId: "s3", runId: "r3" }])),
      "burst",
      jobs,
    ),
  );
});
test("serial rejects missing duplicate or wrong job receipts and stream errors", () => {
  assert.equal(
    checkBatch(stream(events(receipts)), "serial", jobs.slice(0, 2)).receipts
      .length,
    2,
  );
  assert.throws(() =>
    checkBatch(
      stream(events([receipts[0], receipts[0]])),
      "serial",
      jobs.slice(0, 2),
    ),
  );
  assert.throws(() =>
    checkBatch(stream(events(receipts)), "serial", [
      { label: "wrong", holdMs: 0 },
      jobs[1],
    ]),
  );
  assert.throws(() =>
    checkBatch(
      stream([...events(receipts), { type: "error", errorText: "failure" }]),
      "serial",
      jobs.slice(0, 2),
    ),
  );
});

test("parallel admission may reject any job while accepting exactly two", () => {
  for (let rejected = 0; rejected < 3; rejected++) {
    const outputs = [...receipts];
    outputs.splice(rejected, 0, rejection);
    assert.equal(
      checkBatch(stream(events(outputs)), "burst", jobs).receipts.length,
      2,
    );
  }
});
