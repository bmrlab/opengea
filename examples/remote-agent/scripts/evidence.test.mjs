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
  sameSession.receipt = { ...sameSession.receipt, sessionId: "parent-session" };
  assert.throws(() => checkEvidence(sameSession));
});
function hostedEvidence() {
  const e = evidence();
  e.remoteTransport = true;
  e.child.parent_run_id = null;
  e.parentMessages = structuredClone(messages);
  e.parentMessages[0].parts.push({
    type: "tool-runWait",
    state: "output-available",
    input: { runIds: [e.child.id] },
    output: {
      reason: "completed",
      runs: [
        {
          runId: e.child.id,
          sessionId: e.child.session_id,
          status: "finished",
          text: e.marker,
        },
      ],
    },
  });
  return e;
}
test("a local-to-hosted call joins the foreign Run through its actual runWait result", () => {
  checkEvidence(hostedEvidence());
});
test("a foreign Run needs matching completed runWait evidence, not just parent text", () => {
  for (const change of [
    (e) => {
      e.parentMessages[0].parts.pop();
    },
    (e) => {
      e.parentMessages[0].parts.at(-1).output.runs[0].runId = "other";
    },
    (e) => {
      e.parentMessages[0].parts.at(-1).output.runs[0].status = "running";
    },
    (e) => {
      e.parentMessages[0].parts.at(-1).output.runs[0].text = "no result";
    },
  ]) {
    const e = hostedEvidence();
    change(e);
    assert.throws(() => checkEvidence(e));
  }
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
