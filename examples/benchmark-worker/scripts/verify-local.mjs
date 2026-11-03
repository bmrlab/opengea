import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { renderReport } from "./report.mjs";
const base = new URL(process.argv[2] || "http://127.0.0.1:0");
if (base.protocol !== "http:" || base.hostname !== "127.0.0.1")
  throw new Error("Local loopback only");
async function api(path, body) {
  const response = await fetch(new URL(path, base), {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Local API HTTP ${response.status}`);
  return response.json();
}
async function wait(id) {
  for (let i = 0; i < 300; i++) {
    const task = await api(`/api/tasks/${id}`);
    if (task.status === "completed") return task;
    if (!["queued", "running"].includes(task.status))
      throw new Error(`Task ${id}: ${task.status}`);
    await delay(100);
  }
  throw new Error(`Timed out: ${id}`);
}
async function results(id) {
  const items = [];
  let cursor;
  do {
    const page = await api(
      `/api/tasks/${id}/results?limit=2${cursor === undefined ? "" : `&cursor=${cursor}`}`,
    );
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return items;
}
const runs = [];
for (const algorithm of ["overlap", "bm25"]) {
  const submission = {
    kind: "bench",
    requestId: randomUUID(),
    parameters: { algorithm, k: 3 },
    concurrency: 2,
  };
  const submitted = await api("/api/tasks", submission);
  assert.equal((await api("/api/tasks", submission)).id, submitted.id);
  const bench = await wait(submitted.id);
  const executions = await results(bench.id);
  assert.equal(executions.length, 12);
  assert.ok(executions.every((e) => e.status === "completed"));
  const judgeInput = {
    kind: "judge",
    requestId: randomUUID(),
    sourceRunId: bench.id,
    executionIds: executions.map((e) => e.id),
  };
  const judgment = await api("/api/tasks", judgeInput);
  await wait(judgment.id);
  const judgments = await results(judgment.id);
  assert.equal(judgments.length, 13);
  const rejudge = await api("/api/tasks", {
    ...judgeInput,
    requestId: randomUUID(),
    executionIds: executions.slice(0, 2).map((e) => e.id),
  });
  await wait(rejudge.id);
  assert.equal((await results(rejudge.id)).length, 3);
  assert.deepEqual(await results(bench.id), executions);
  runs.push({
    algorithm,
    bench,
    judgeTaskId: judgment.id,
    rejudgeTaskId: rejudge.id,
    executions,
    judgments,
  });
}
await mkdir("dist", { recursive: true });
await writeFile("dist/results.json", JSON.stringify(runs, null, 2));
await writeFile("dist/report.html", renderReport(runs));
console.log(
  JSON.stringify(
    runs.map((r) => ({
      algorithm: r.algorithm,
      bench: r.bench.id,
      summary: r.judgments.at(-1).value,
    })),
    null,
    2,
  ),
);
