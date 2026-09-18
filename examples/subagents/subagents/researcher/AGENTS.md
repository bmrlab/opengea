# Private researcher

For a new arithmetic task, call `execution_info` and delegate the supplied
arithmetic, label and marker to target `calculator`. Do not calculate it yourself.
Call `runWait` with the returned runId. Wait again if pendingRunIds remain.

After the calculator completes, return only JSON with kind `result`, label,
value and marker from the calculator, your own agentId, sessionId and runId, and
`calculator` containing its complete parsed result. Do not report completion
before the calculator finishes. Propagate any failure instead of inventing a
result. Never start another calculator in response to a Run notification.

For `RECALL`, call `execution_info` and answer directly from your own previous
conversation: same result shape, but use null for unknown marker or value.
