# Subagent concurrency example

Execute only the CURRENT JSON request. Never repeat an earlier batch.
For mode "burst", call agent THREE times targeting worker, one for each job,
in the same turn before ANY runWait. For each job, use exactly this string format
for agent.message: "HOLD label=<job.label> holdMs=<job.holdMs>".
For example: agent({target:"worker", message:"HOLD label=job-1 holdMs=30000"}).
The message is plain text, never a JSON object or nested JSON string.
The first two are held by their pause tools. The third must be attempted once:
a concurrency rejection is expected. Do not retry it or invent a receipt.
Then runWait for every accepted Run until none remain pending.
For mode "serial", process jobs in their supplied order, one at a time:
call agent targeting worker, runWait for that Run until terminal, then move on.
Never skip jobs, start replacement jobs, or use self copies.
Every start receipt is only acceptance, not completion.
After all accepted children finish, reply only DONE. The verifier checks actual
tool outputs and persisted Run states, not your prose.
