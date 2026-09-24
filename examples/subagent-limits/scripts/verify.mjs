import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { env } from "./env.mjs";
import { checkBatch } from "./protocol.mjs";

const local = process.argv.includes("--local");
const api = (local ? env.localApi : env.api)?.replace(/\/$/u, "");
assert.ok(api, "Set GEA_AGENTS_API_URL");
const url = new URL(api);
const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
assert.ok(url.protocol === "https:" || (url.protocol === "http:" && loopback));
assert.ok(!url.username && !url.password && !url.search && !url.hash);
assert.ok(!local || loopback);
assert.ok(local || env.apiKey, "Set GEA_PROJECT_API_KEY");
const environment = local ? "local" : env.environment;
assert.ok(["local", "preview", "production"].includes(environment));
const id = randomUUID();
const directory = `.gea/verification/${id}`;
await mkdir(directory, { recursive: true });
const report = {
  id,
  api,
  environment,
  startedAt: new Date().toISOString(),
  status: "running",
  batches: [],
};
const save = () =>
  writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
// Writes are never retried: a transport failure may hide an accepted Run.
async function request(method, path, body, attempt = 0) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(local ? {} : { Authorization: `Bearer ${env.apiKey}` }),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(600_000),
  });
  if (method === "GET" && response.status === 429 && attempt < 5) {
    const seconds = Number(response.headers.get("retry-after") || 5);
    await response.body?.cancel();
    await setTimeout(
      (Number.isFinite(seconds) ? Math.max(1, Math.min(60, seconds)) : 5) *
        1000,
    );
    return request(method, path, body, attempt + 1);
  }
  assert.ok(
    response.ok,
    `${method} ${path}: ${response.status} ${response.ok ? "" : await response.text()}`,
  );
  return response;
}
const json = async (method, path, body) =>
  (await request(method, path, body)).json();
async function messages(sessionId) {
  const all = [];
  let after;
  do {
    const page = await json(
      "GET",
      `/sessions/${sessionId}/messages?limit=100${after === undefined ? "" : `&cursor=${encodeURIComponent(after)}`}`,
    );
    all.push(...page.items);
    after = page.next_cursor;
  } while (after !== null && after !== undefined);
  return all;
}
async function batch(mode, jobs) {
  const record = { mode, jobs, startedAt: new Date().toISOString() };
  report.batches.push(record);
  await save();
  const response = await request("POST", `/sessions/${report.sessionId}/runs`, {
    input: JSON.stringify({ mode, jobs }),
    stream: true,
  });
  record.runId = response.headers.get("x-gea-agent-run-id");
  await save();
  record.body = await response.text();
  await save();
  const parsed = checkBatch(record.body, mode, jobs);
  Object.assign(record, parsed);
  assert.ok(record.runId, "Run identity header required");
  const deadline = Date.now() + 120_000;
  while (true) {
    record.run = await json("GET", `/runs/${record.runId}`);
    if (record.run.status === "finished") break;
    assert.ok(
      !["failed", "cancelled", "aborted"].includes(record.run.status),
      JSON.stringify(record.run),
    );
    assert.ok(Date.now() < deadline, "parent did not become terminal");
    await setTimeout(1000);
  }
  record.children = [];
  for (const receipt of record.receipts) {
    const run = await json("GET", `/runs/${receipt.runId}`);
    assert.equal(run.status, "finished");
    assert.equal(run.session_id, receipt.sessionId);
    assert.equal(run.parent_run_id, record.runId);
    const history = await messages(receipt.sessionId);
    const outputs = history
      .flatMap((m) => m.parts || [])
      .filter((p) => p.type === "tool-pause" && p.state === "output-available")
      .map((p) => p.output);
    assert.equal(
      outputs.length,
      1,
      "child must execute the pause tool exactly once",
    );
    assert.deepEqual(outputs[0], {
      label: receipt.label,
      holdMs: receipt.holdMs,
      sessionId: receipt.sessionId,
      runId: receipt.runId,
    });
    if (mode === "serial" && record.children.length) {
      const previous = record.children.at(-1).run;
      assert.ok(
        Date.parse(run.created_at) >= Date.parse(previous.finished_at),
        "serial children must not overlap",
      );
    }
    record.children.push({ run, history });
  }
  record.finishedAt = new Date().toISOString();
  await save();
  console.log(
    `${mode}: ${record.receipts.length} finished; ${record.rejections.length} rejected; parent ${record.runId}`,
  );
}
try {
  const catalog = await json("GET", `/agents?environment=${environment}`);
  const agent = catalog.items.find((a) =>
    env.agentId ? a.id === env.agentId : a.name === "subagent-limits",
  );
  assert.ok(agent, "Deploy the subagent-limits Agent or set GEA_AGENT_ID");
  report.agent = agent;
  const session = await json("POST", "/sessions", {
    agent_id: agent.id,
    environment,
    title: `subagent-limits-${id}`,
  });
  report.sessionId = session.id;
  await save();
  console.log(`Report: ${directory}/report.json; session ${session.id}`);
  await batch(
    "burst",
    [0, 1, 2].map((i) => ({ label: `burst-${id}-${i}`, holdMs: 30_000 })),
  );
  // Same parent Session throughout. Each batch explicitly waits between starts.
  for (let offset = 0; offset < 140; offset += 10) {
    await batch(
      "serial",
      Array.from({ length: 10 }, (_, i) => ({
        label: `serial-${id}-${offset + i + 1}`,
        holdMs: 0,
      })),
    );
    console.log(`Sequential total: ${offset + 10}/140`);
  }
  const receipts = report.batches.flatMap((b) => b.receipts);
  assert.equal(receipts.length, 142);
  assert.equal(new Set(receipts.map((r) => r.runId)).size, 142);
  report.parentHistory = await messages(report.sessionId);
  const persisted = report.parentHistory
    .flatMap((m) => m.parts || [])
    .filter(
      (p) =>
        p.type === "tool-agent" &&
        p.state === "output-available" &&
        p.output?.runId,
    )
    .map((p) => p.output.runId);
  assert.deepEqual(
    new Set(persisted),
    new Set(receipts.map((r) => r.runId)),
    "all child receipts must remain readable after Run 128",
  );
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  process.exitCode = 1;
  console.error(error);
} finally {
  report.finishedAt = new Date().toISOString();
  await save();
  console.log(`Saved ${directory}/report.json`);
}
