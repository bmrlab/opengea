import assert from "node:assert/strict";
import { test } from "node:test";
import { checkEvidence, findRemoteReceipt } from "./evidence.mjs";
const messages = [
  {
    role: "assistant",
    parts: [
      {
        type: "tool-agent",
        state: "output-available",
        input: { target: "musedam", message: "Return a marker" },
        output: { sessionId: "child-session", runId: "child-run" },
      },
      { type: "text", text: "REMOTE:marker" },
    ],
  },
];
const evidence = () => ({
  targetAgentId: "remote-id",
  marker: "REMOTE:marker",
  parent: {
    id: "parent-run",
    session_id: "parent-session",
    status: "finished",
  },
  receipt: findRemoteReceipt(messages),
  parentMessages: messages,
  child: {
    id: "child-run",
    session_id: "child-session",
    parent_run_id: "parent-run",
    status: "finished",
  },
  childSession: { id: "child-session", agent_id: "remote-id" },
  childMessages: [
    { role: "assistant", parts: [{ type: "text", text: "REMOTE:marker" }] },
  ],
});
test("accepts a finished remote child and its returned result", () =>
  checkEvidence(evidence()));
test("rejects parent text without a real agent tool receipt", () =>
  assert.throws(() =>
    findRemoteReceipt([
      { role: "assistant", parts: [{ type: "text", text: "REMOTE:marker" }] },
    ]),
  ));
test("a start receipt or failed child is not completion", () => {
  for (const status of ["running", "error", "cancelled"]) {
    const e = evidence();
    e.child.status = status;
    assert.throws(() => checkEvidence(e));
  }
});
test("rejects a different target, parent or reused parent session", () => {
  const wrongTarget = evidence();
  wrongTarget.childSession.agent_id = "other";
  assert.throws(() => checkEvidence(wrongTarget));
  const wrongParent = evidence();
  wrongParent.child.parent_run_id = "other";
  assert.throws(() => checkEvidence(wrongParent));
  const sameSession = evidence();
  sameSession.receipt.sessionId = "parent-session";
  assert.throws(() => checkEvidence(sameSession));
});
test("rejects a child result missing from the final parent response", () => {
  const e = evidence();
  e.parentMessages = [
    {
      role: "assistant",
      parts: [messages[0].parts[0], { type: "text", text: "done" }],
    },
  ];
  assert.throws(() => checkEvidence(e));
});
