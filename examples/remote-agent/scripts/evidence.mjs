import assert from "node:assert/strict";

export function findRemoteReceipt(messages) {
  const calls = messages
    .flatMap((message) => (message.role === "assistant" ? message.parts : []))
    .filter(
      (part) => part.type === "tool-agent" && part.input?.target === "musedam",
    );
  assert.equal(calls.length, 1, "Expected exactly one real remote agent call");
  const call = calls[0];
  assert.equal(call.state, "output-available", "Remote admission must succeed");
  assert.equal(
    typeof call.output?.sessionId,
    "string",
    "Missing child Session receipt",
  );
  assert.equal(
    typeof call.output?.runId,
    "string",
    "Missing child Run receipt",
  );
  return call.output;
}

function assistantText(messages) {
  return messages
    .filter((message) => message.role === "assistant")
    .flatMap((message) => message.parts)
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function checkEvidence(e) {
  assert.equal(e.parent.status, "finished", "Parent must finish");
  assert.notEqual(
    e.receipt.sessionId,
    e.parent.session_id,
    "Remote Session must be independent",
  );
  assert.notEqual(
    e.receipt.runId,
    e.parent.id,
    "Remote Run must be independent",
  );
  assert.equal(e.child.id, e.receipt.runId);
  assert.equal(e.child.session_id, e.receipt.sessionId);
  assert.equal(
    e.child.status,
    "finished",
    "A receipt is not a completed child",
  );
  assert.equal(
    e.child.parent_run_id,
    e.parent.id,
    "Child must belong to this parent Run",
  );
  assert.equal(e.childSession.id, e.receipt.sessionId);
  assert.equal(
    e.childSession.agent_id,
    e.targetAgentId,
    "The selected remote Agent must execute",
  );
  assert.ok(
    assistantText(e.childMessages).includes(e.marker),
    "Missing remote output",
  );
  assert.ok(
    assistantText(e.parentMessages).includes(e.marker),
    "Missing result returned to parent",
  );
}
