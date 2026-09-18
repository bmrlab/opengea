import assert from "node:assert/strict";
import test from "node:test";
import {
  parseRun,
  findSummary,
  checkSummary,
  checkStreamMessage,
} from "./protocol.mjs";

test("a working receipt is not a completed result", () => {
  const run = parseRun(
    'data: {"type":"tool-input-available","toolName":"agent","toolCallId":"t"}\n\ndata: {"type":"tool-output-available","toolCallId":"t","output":{"runId":"task","sessionId":"child"}}\n\ndata: {"type":"finish","finishReason":"stop"}\n\ndata: [DONE]\n\n',
  );
  assert.equal(run.receipts.length, 1);
  assert.equal(
    findSummary(
      [{ role: "assistant", parts: [{ type: "text", text: "WAITING" }] }],
      "batch",
    ),
    undefined,
  );
});

test("stream errors and truncated turns fail verification", () => {
  assert.throws(
    () => parseRun('data: {"type":"error","errorText":"upstream failed"}\n\n'),
    /upstream failed/,
  );
  assert.throws(
    () => parseRun('data: {"type":"finish","finishReason":"length"}\n\n'),
    /length/,
  );
  assert.throws(
    () => parseRun('data: {"type":"text-delta","delta":"partial"}\n\n'),
    /finish/,
  );
});

test("only an assistant summary for the current batch is accepted", () => {
  const text = JSON.stringify({
    kind: "summary",
    batch: "one",
    runId: "parent-run",
    sessionId: "parent",
    results: [],
  });
  assert.equal(
    findSummary([{ role: "user", parts: [{ type: "text", text }] }], "one"),
    undefined,
  );
  assert.equal(
    findSummary(
      [{ role: "assistant", parts: [{ type: "text", text }] }],
      "two",
    ),
    undefined,
  );
  assert.equal(
    findSummary(
      [
        {
          role: "assistant",
          parts: [{ type: "text", text: `\`\`\`json\n${text}\n\`\`\`` }],
        },
      ],
      "one",
    ).batch,
    "one",
  );
});

test("the checker rejects reused parent identity and fabricated receipts", () => {
  const jobs = [
    { label: "review", target: "reviewer", value: 42, marker: "remember-me" },
  ];
  const receipts = [{ runId: "task", sessionId: "child" }];
  const summary = {
    kind: "summary",
    batch: "one",
    runId: "parent-run",
    sessionId: "parent",
    results: [
      {
        label: "review",
        target: "reviewer",
        runId: "task",
        sessionId: "child",
        status: "finished",
        result: {
          kind: "result",
          label: "review",
          value: 42,
          marker: "remember-me",
          sessionId: "child",
          agentId: "definition",
          runId: "task",
        },
      },
    ],
  };
  checkSummary(summary, jobs, receipts, "parent");
  assert.throws(
    () =>
      checkSummary(
        {
          ...summary,
          results: [{ ...summary.results[0], runId: "invented" }],
        },
        jobs,
        receipts,
        "parent",
      ),
    /receipt/,
  );
  assert.throws(
    () =>
      checkSummary(
        {
          ...summary,
          results: [
            {
              ...summary.results[0],
              result: { ...summary.results[0].result, sessionId: "parent" },
            },
          ],
        },
        jobs,
        receipts,
        "parent",
      ),
    /session must match receipt/,
  );
  assert.throws(
    () =>
      checkSummary(
        { ...summary, results: [{ ...summary.results[0], status: "error" }] },
        jobs,
        receipts,
        "parent",
      ),
    /finished/,
  );
});

test("a failed run in a prose-wrapped summary reports its cause", () => {
  const value = {
    kind: "summary",
    batch: "failed-batch",
    runId: "parent-run",
    sessionId: "parent",
    results: [
      {
        label: "review",
        target: "reviewer",
        runId: "task",
        sessionId: "child",
        status: "error",
        result: null,
        error: "Child Agent invocation failed (500).",
      },
    ],
  };
  const summary = findSummary(
    [
      {
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `The child failed.\n\`\`\`json\n${JSON.stringify(value)}\n\`\`\``,
          },
        ],
      },
    ],
    "failed-batch",
  );
  assert.ok(summary, "terminal failure must not become a polling timeout");
  assert.throws(
    () =>
      checkSummary(
        summary,
        [{ label: "review", target: "reviewer", value: 42, marker: null }],
        [{ runId: "task", sessionId: "child" }],
        "parent",
      ),
    /invocation failed \(500\)/,
  );
});

test("execution identity is not a child invocation receipt", () => {
  const run = parseRun(
    'data: {"type":"tool-input-available","toolName":"execution_info","toolCallId":"i"}\n\ndata: {"type":"tool-output-available","toolCallId":"i","output":{"sessionId":"parent","runId":"parent-run"}}\n\ndata: {"type":"finish","finishReason":"stop"}\n\n',
  );
  assert.deepEqual(run.receipts, []);
});

test("automatic continuation can append a summary to the waiting assistant", () => {
  const summary = {
    kind: "summary",
    batch: "resumed",
    runId: "parent-run",
    sessionId: "parent",
    results: [],
  };
  assert.deepEqual(
    findSummary(
      [{
        role: "assistant",
        parts: [
          { type: "text", text: "WAITING" },
          { type: "step-start" },
          { type: "text", text: JSON.stringify(summary) },
        ],
      }],
      "resumed",
    ),
    summary,
  );
});

test("streamed continuation must match one saved assistant without duplication", () => {
  const events = [
    { type: "start", messageId: "assistant-1" },
    { type: "text-delta", delta: "WAITING" },
    {
      type: "tool-input-available",
      toolName: "runWait",
      toolCallId: "wait-1",
    },
    {
      type: "tool-output-available",
      toolCallId: "wait-1",
      output: { pendingRunIds: [] },
    },
    { type: "text-delta", delta: "final" },
    { type: "finish", finishReason: "stop" },
  ];
  const message = {
    id: "assistant-1",
    role: "assistant",
    parts: [
      { type: "text", text: "WAITING" },
      {
        type: "tool-runWait",
        toolCallId: "wait-1",
        state: "output-available",
        output: { pendingRunIds: [] },
      },
      { type: "text", text: "final" },
    ],
  };
  assert.equal(checkStreamMessage(events, [message]), message.id);
  assert.throws(
    () => checkStreamMessage(
      [...events, { type: "start", messageId: "assistant-2" }],
      [message],
    ),
    /one assistant/,
  );
  assert.throws(
    () => checkStreamMessage(events, [{
      ...message,
      parts: [...message.parts, { type: "text", text: "WAITING" }],
    }]),
    /streamed text/,
  );
  assert.throws(
    () => checkStreamMessage(events, [{
      ...message,
      parts: message.parts.filter((part) => part.type === "text"),
    }]),
    /runWait output/,
  );
});
