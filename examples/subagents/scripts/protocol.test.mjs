import assert from "node:assert/strict";
import test from "node:test";
import { parseRun, findSummary, checkSummary } from "./protocol.mjs";

test("a working receipt is not a completed result", () => {
  const run = parseRun(
    'data: {"type":"tool-output-available","toolCallId":"t","output":{"status":"working","taskId":"task","agentId":"child"}}\n\ndata: {"type":"finish","finishReason":"stop"}\n\ndata: [DONE]\n\n',
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
    chatId: "parent",
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
  const receipts = [{ taskId: "task", agentId: "handle" }];
  const summary = {
    kind: "summary",
    batch: "one",
    chatId: "parent",
    results: [
      {
        label: "review",
        target: "reviewer",
        taskId: "task",
        agentId: "handle",
        status: "completed",
        result: {
          kind: "result",
          label: "review",
          value: 42,
          marker: "remember-me",
          chatId: "child",
          agentId: "definition",
          runId: "run",
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
          results: [{ ...summary.results[0], taskId: "invented" }],
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
              result: { ...summary.results[0].result, chatId: "parent" },
            },
          ],
        },
        jobs,
        receipts,
        "parent",
      ),
    /independent/,
  );
  assert.throws(
    () =>
      checkSummary(
        { ...summary, results: [{ ...summary.results[0], status: "failed" }] },
        jobs,
        receipts,
        "parent",
      ),
    /completed/,
  );
});

test("a failed task in a prose-wrapped summary reports its cause", () => {
  const value = {
    kind: "summary",
    batch: "failed-batch",
    chatId: "parent",
    results: [
      {
        label: "review",
        target: "reviewer",
        taskId: "task",
        agentId: "child",
        status: "failed",
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
        [{ taskId: "task", agentId: "child" }],
        "parent",
      ),
    /invocation failed \(500\)/,
  );
});
