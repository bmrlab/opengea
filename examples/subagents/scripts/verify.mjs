import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { env } from "./env.mjs";
import { checkSummary, findSummary, parseRun } from "./protocol.mjs";

const local = process.argv.includes("--local");
const api = (local ? env.localApi : env.api)?.replace(/\/$/u, "");
assert.ok(api, "Set GEA_AGENTS_API_URL to the /api/v1 root");
const url = new URL(api);
const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
assert.ok(url.protocol === "https:" || (url.protocol === "http:" && loopback));
assert.ok(!url.username && !url.password && !url.search && !url.hash);
assert.ok(!local || loopback, "Local verification requires a loopback API");
assert.ok(
  local || env.apiKey,
  "Set GEA_PROJECT_API_KEY for hosted verification",
);
const environment = local ? "local" : "preview";
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

// Never retry writes: a transport failure may hide an accepted invocation.
async function request(method, path, body, attempt = 0) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(local ? {} : { Authorization: `Bearer ${env.apiKey}` }),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(120_000),
  });
  if (method === "GET" && response.status === 429 && attempt < 5) {
    const failure = await response.json();
    const seconds = Number(
      response.headers.get("retry-after") ??
        failure.error?.data?.retryAfterSeconds ??
        5,
    );
    await setTimeout(
      (Number.isFinite(seconds) ? Math.max(1, Math.min(60, seconds)) : 5) *
        1000,
    );
    return request(method, path, body, attempt + 1);
  }
  if (!response.ok)
    throw new Error(
      `${method} ${path}: HTTP ${response.status} ${await response.text()}`,
    );
  return response;
}
async function json(method, path, body) {
  return (await request(method, path, body)).json();
}

async function verifyBatch(batch, jobs, sessionId, waitMode = "implicit") {
  if (!sessionId) {
    const agents = await json("GET", `/agents?environment=${environment}`);
    const agent = agents.items.find((item) =>
      env.agentId
        ? item.id === env.agentId
        : item.name === "subagent-coordinator",
    );
    assert.ok(agent, "Start/publish the coordinator, or set GEA_AGENT_ID");
    const session = await json("POST", "/sessions", {
      agent_id: agent.id,
      environment,
      title: batch,
    });
    sessionId = session.id;
  }
  const parentMarker = randomUUID();
  const input = {
    batch,
    waitMode,
    parentOnlyMarker: parentMarker,
    jobs: jobs.map(({ label, target, sessionId, message }) => ({
      label,
      target,
      sessionId,
      message,
    })),
  };
  const message = `Execute this batch exactly. Do not send parentOnlyMarker to any child. Call execution_info again for THIS batch, even if earlier history has your identity. Start all jobs before waiting. Follow your instructions for waitMode and return the complete summary after all child Runs finish.\n${JSON.stringify(input)}`;
  const response = await request("POST", `/sessions/${sessionId}/runs`, {
    input: message,
    stream: true,
  });
  const runId = response.headers.get("x-gea-agent-run-id");
  const body = await response.text();
  const entry = { batch, input, sessionId, runId, body, observations: [] };
  report.batches.push(entry);
  await save();
  assert.ok(runId, "missing parent Run ID");
  assert.equal(response.headers.get("x-gea-agent-session-id"), sessionId);
  const initial = parseRun(body);
  assert.equal(
    initial.receipts.length,
    jobs.length,
    "initial invocation must start every requested job",
  );
  const calls = initial.events.filter(
    (event) =>
      event.type === "tool-input-available" && event.toolName === "agent",
  );
  assert.equal(calls.length, jobs.length);
  assert.ok(
    calls.every((call) => !JSON.stringify(call.input).includes(parentMarker)),
    "parent history must not leak",
  );
  if (waitMode === "explicit")
    assert.ok(
      initial.events.some(
        (event) =>
          event.type === "tool-input-available" &&
          event.toolName === "run_wait",
      ),
      "explicit wait must invoke run_wait",
    );
  if (waitMode === "implicit")
    assert.ok(
      !initial.events.some(
        (event) =>
          event.type === "tool-input-available" &&
          event.toolName === "run_wait",
      ),
      "implicit joining must not use run_wait",
    );
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const [run, session, page] = await Promise.all([
      json("GET", `/runs/${runId}`),
      json("GET", `/sessions/${sessionId}`),
      json("GET", `/sessions/${sessionId}/messages?limit=100`),
    ]);
    assert.equal(run.id, runId);
    assert.equal(run.session_id, sessionId);
    if (session.active_run)
      assert.equal(
        session.active_run.id,
        runId,
        "wait/resume must keep the parent Run ID",
      );
    entry.observations.push({ run, activeRun: session.active_run });
    entry.messages = page.items;
    if (run.status === "finished") {
      const summary = findSummary(page.items, batch);
      assert.ok(summary, "finished Run must contain the requested summary");
      assert.equal(
        summary.runId,
        runId,
        "summary must keep the logical parent Run ID",
      );
      checkSummary(summary, jobs, initial.receipts, sessionId);
      entry.summary = summary;
      entry.children = [];
      for (const receipt of initial.receipts) {
        const [childRun, childSession, childMessages] = await Promise.all([
          json("GET", `/runs/${receipt.runId}`),
          json("GET", `/sessions/${receipt.sessionId}`),
          json("GET", `/sessions/${receipt.sessionId}/messages?limit=100`),
        ]);
        assert.equal(childRun.status, "finished");
        assert.equal(childRun.session_id, receipt.sessionId);
        assert.equal(childRun.parent_run_id, runId);
        assert.equal(childSession.id, receipt.sessionId);
        assert.ok(
          !JSON.stringify(childMessages).includes(parentMarker),
          "child history must not contain parent-only marker",
        );
        entry.children.push({
          run: childRun,
          session: childSession,
          messages: childMessages.items,
        });
      }
      entry.status = "passed";
      await save();
      console.log(
        `${batch}: ${jobs.length} child Runs finished; ${waitMode} waiting preserved Run ID`,
      );
      return { sessionId, summary, receipts: initial.receipts };
    }
    assert.ok(
      ["queued", "running", "waiting"].includes(run.status),
      `Parent Run ${runId}: ${run.status}`,
    );
    await save();
    await setTimeout(local ? 1000 : 5000);
  }
  throw new Error(`Timed out waiting for Run ${runId}`);
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
        sessionId: previous.sessionId,
        message:
          "RECALL label=recall. Return the marker and arithmetic value previously supplied in your own conversation; do not delegate.",
        value: a + b,
        marker,
      },
    ],
    parallel.sessionId,
    "explicit",
  );
  assert.equal(
    continued.receipts[0].sessionId,
    previous.sessionId,
    "continuation must reuse the child Session",
  );
  assert.notEqual(
    continued.receipts[0].runId,
    previous.runId,
    "continuation must create a new run",
  );
  assert.equal(
    continued.summary.results[0].result.sessionId,
    previous.result.sessionId,
    "continuation must preserve the child Session",
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
    parallel.sessionId,
  );
  assert.notEqual(fresh.receipts[0].sessionId, previous.sessionId);
  assert.notEqual(
    fresh.summary.results[0].result.sessionId,
    previous.result.sessionId,
  );
  const peerMarker = `peer-${randomUUID()}`;
  const peerMessage = `LEAF label=inbox. Calculate ${a} + ${b}. Remember marker ${peerMarker}.`;
  const relay = await verifyBatch(
    `relay-${id}`,
    [
      {
        label: "relay",
        target: "reviewer",
        sessionId: previous.sessionId,
        message: `SEND label=relay targetSessionId=${fresh.receipts[0].sessionId}. Use chat_send to send exactly this message: ${peerMessage}. Return value null and marker null with your current execution identities.`,
        value: null,
        marker: null,
      },
    ],
    parallel.sessionId,
    "explicit",
  );
  const sender = report.batches.at(-1).children[0];
  const sendCall = sender.messages
    .filter((m) => m.run_id === relay.receipts[0].runId)
    .flatMap((m) => m.parts)
    .find((p) => p.type === "tool-chat_send" && p.state === "output-available");
  assert.ok(sendCall, "sender must actually call chat_send");
  assert.equal(sendCall.input.chatId, fresh.receipts[0].sessionId);
  assert.equal(sendCall.input.message, peerMessage);
  const deadline = Date.now() + 120_000;
  let received = false;
  while (Date.now() < deadline) {
    const page = await json(
      "GET",
      `/sessions/${fresh.receipts[0].sessionId}/messages?limit=100`,
    );
    report.peerMessages = page.items;
    const answer = page.items.find(
      (m) =>
        m.role === "assistant" &&
        m.run_id !== fresh.receipts[0].runId &&
        m.parts.some((p) => p.type === "text" && p.text.includes(peerMarker)),
    );
    if (answer) {
      const run = await json("GET", `/runs/${answer.run_id}`);
      if (run.status === "finished") {
        assert.equal(run.session_id, fresh.receipts[0].sessionId);
        report.peerRun = run;
        received = true;
        break;
      }
    }
    await save();
    await setTimeout(local ? 1000 : 5000);
  }
  assert.ok(
    received,
    "peer Session must receive the message and finish its new Run",
  );
  console.log(
    "peer communication: chat_send delivered to sibling Session and produced a finished Run",
  );
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error =
    error instanceof Error
      ? `${error.message}${error.cause ? ` (${String(error.cause)})` : ""}`
      : String(error);
  process.exitCode = 1;
} finally {
  await save();
  console.log(`${report.status}: ${directory}/report.json`);
  if (report.error) console.error(report.error);
}
