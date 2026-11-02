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
  if (e.remoteTransport) {
    // A local parent is not a row in the hosted Run directory. Its AgentSession
    // owns the relation; verify the actual completed foreign receipt there.
    const waits = e.parentMessages
      .filter((message) => message.role === "assistant")
      .flatMap((message) => message.parts)
      .filter(
        (part) =>
          part.type === "tool-runWait" &&
          part.state === "output-available" &&
          part.input?.runIds?.includes(e.child.id),
      );
    assert.ok(
      waits.some((part) =>
        part.output?.runs?.some(
          (run) =>
            run.runId === e.child.id &&
            run.sessionId === e.child.session_id &&
            run.status === "finished" &&
            run.text?.includes(e.marker),
        ),
      ),
      "Local parent must observe the completed hosted Run and its actual result",
    );
  } else {
    assert.equal(
      e.child.parent_run_id,
      e.parent.id,
      "Child must belong to this parent Run",
    );
  }
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
