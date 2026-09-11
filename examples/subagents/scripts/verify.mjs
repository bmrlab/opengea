import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { StudioAgentClient } from "@gea-ai/agent-sdk/studio-server";
import { z } from "zod";
import { env } from "./env.mjs";
import { checkSummary, findSummary, parseRun } from "./protocol.mjs";

const local = process.argv.includes("--local");
if (!local && (!env.api || !env.apiKey))
  throw new Error(
    "Set GEA_AGENT_URL and GEA_PROJECT_API_KEY for a hosted Preview Agent.",
  );
// The published client validates HTTPS and rejects URL credentials/redirects.
const client = local
  ? null
  : new StudioAgentClient({ api: env.api, apiKey: env.apiKey });
const api = (local ? env.localApi : env.api).replace(/\/$/u, "");
if (
  local &&
  !["127.0.0.1", "localhost", "[::1]"].includes(new URL(api).hostname)
)
  throw new Error("Local verification requires a loopback Agent URL.");
const messageSchema = z.object({
  role: z.string(),
  parts: z.array(
    z.object({ type: z.string(), text: z.string().optional() }).passthrough(),
  ),
});
const pageSchema = z.object({ items: z.array(messageSchema) });
const stateSchema = z.object({
  messages: z.array(z.object({ message: messageSchema })),
});
const id = randomUUID();
const directory = `.gea/verification/${id}`;
await mkdir(directory, { recursive: true });
const report = {
  id,
  api,
  mode: local ? "local" : "hosted",
  batches: [],
  status: "running",
};
const save = () =>
  writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));

async function verifyBatch(batch, jobs, chatId) {
  const parentMarker = randomUUID();
  const input = {
    batch,
    parentOnlyMarker: parentMarker,
    jobs: jobs.map(({ label, target, agentId, message }) => ({
      label,
      target,
      agentId,
      message,
    })),
  };
  const message = `Execute this batch exactly. Do not send parentOnlyMarker to any child. Call agent once for each job using its exact message, optional target and optional agentId. After starting all jobs, reply WAITING and end the turn. On later task updates, return the summary JSON required by your instructions.\n${JSON.stringify(input)}`;
  const request = { ...(chatId ? { chatId } : {}), message };
  const signal = AbortSignal.timeout(120_000);
  const response = client
    ? await client.run(request, { signal })
    : await fetch(`${api}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        redirect: "error",
        signal,
      });
  const body = await response.text();
  const entry = { batch, input, httpStatus: response.status, body };
  report.batches.push(entry);
  await save();
  if (!response.ok)
    throw new Error(`Run failed: HTTP ${response.status}; see ${directory}`);
  const parentChatId = response.headers.get("x-gea-agent-chat-id");
  assert.ok(parentChatId, "missing parent Chat ID");
  if (chatId) assert.equal(parentChatId, chatId);
  entry.chatId = parentChatId;
  const run = parseRun(body);
  assert.equal(
    run.receipts.length,
    jobs.length,
    "initial turn must start every requested job",
  );
  const calls = run.events.filter(
    (event) =>
      event.type === "tool-input-available" && event.toolName === "agent",
  );
  assert.equal(calls.length, jobs.length);
  assert.ok(
    calls.every((call) => !JSON.stringify(call.input).includes(parentMarker)),
    "parent-only history must not be copied to children",
  );
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const history = await fetch(
      local
        ? `${api}/sessions/${parentChatId}/v1/state`
        : `${api}/chats/${parentChatId}/messages?limit=100`,
      {
        headers: local ? {} : { Authorization: `Bearer ${env.apiKey}` },
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!history.ok)
      throw new Error(`History lookup failed: HTTP ${history.status}`);
    const data = await history.json();
    entry.messages = local
      ? stateSchema.parse(data).messages.map(({ message }) => message)
      : pageSchema.parse(data).items;
    const summary = findSummary(entry.messages, batch);
    if (summary) {
      entry.summary = summary;
      checkSummary(summary, jobs, run.receipts, parentChatId);
      entry.status = "passed";
      await save();
      console.log(
        `${batch}: ${jobs.length} task(s) completed; parent resumed automatically`,
      );
      return { chatId: parentChatId, summary, receipts: run.receipts };
    }
    await save();
    await setTimeout(1000);
  }
  throw new Error(
    `Timed out waiting for automatic parent continuation: ${batch}`,
  );
}

try {
  const a = randomInt(11, 30),
    b = randomInt(11, 30);
  const marker = `review-${randomUUID()}`;
  const parallel = await verifyBatch(`parallel-${id}`, [
    {
      label: "private",
      target: "researcher",
      message: `LEAF label=private. Calculate ${a} * ${b}. No marker is supplied.`,
      value: a * b,
      marker: null,
      nested: true,
    },
    {
      label: "review",
      target: "reviewer",
      message: `LEAF label=review. Calculate ${a} + ${b}. Remember marker ${marker}.`,
      value: a + b,
      marker,
    },
    {
      label: "copy",
      message: `LEAF label=copy. Calculate ${a} - ${b}. No marker is supplied.`,
      value: a - b,
      marker: null,
    },
  ]);
  const previous = parallel.summary.results.find(
    (row) => row.label === "review",
  );
  const continued = await verifyBatch(
    `continue-${id}`,
    [
      {
        label: "recall",
        target: "reviewer",
        agentId: previous.agentId,
        message:
          "RECALL label=recall. Return the marker and arithmetic value previously supplied in your own conversation; do not delegate.",
        value: a + b,
        marker,
      },
    ],
    parallel.chatId,
  );
  assert.equal(
    continued.receipts[0].agentId,
    previous.agentId,
    "continuation must reuse the child handle",
  );
  assert.notEqual(
    continued.receipts[0].taskId,
    previous.taskId,
    "continuation must create a new task",
  );
  assert.equal(
    continued.summary.results[0].result.chatId,
    previous.result.chatId,
    "continuation must preserve the child chat",
  );
  const fresh = await verifyBatch(
    `fresh-child-${id}`,
    [
      {
        label: "fresh",
        target: "reviewer",
        message:
          "RECALL label=fresh. Return the marker and arithmetic value previously supplied in your own conversation; use null for anything unknown.",
        value: null,
        marker: null,
      },
    ],
    parallel.chatId,
  );
  assert.notEqual(fresh.receipts[0].agentId, previous.agentId);
  assert.notEqual(
    fresh.summary.results[0].result.chatId,
    previous.result.chatId,
  );
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await save();
  console.log(`${report.status}: ${directory}/report.json`);
  if (report.error) console.error(report.error);
}
