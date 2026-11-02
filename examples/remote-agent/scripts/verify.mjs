import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { checkEvidence, findRemoteReceipt } from "./evidence.mjs";

export async function verify({
  api,
  token,
  callerId,
  targetId,
  environment,
  directory,
  remoteApi,
}) {
  const origin = new URL(api);
  assert.ok(
    origin.protocol === "https:" ||
      (origin.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)),
    "Use HTTPS or loopback HTTP",
  );
  assert.ok(
    !origin.username && !origin.password && !origin.search && !origin.hash,
  );
  assert.ok(
    token && callerId && targetId,
    "Provide caller ID, target ID and an access token",
  );
  assert.ok(["local", "preview", "production"].includes(environment));
  if (remoteApi) {
    const remote = new URL(remoteApi);
    assert.equal(remote.protocol, "https:");
    assert.ok(
      !remote.username && !remote.password && !remote.search && !remote.hash,
    );
    assert.equal(
      environment,
      "local",
      "Split local/hosted verification requires a local caller",
    );
    assert.equal(origin.protocol, "http:");
  }
  const report = {
    status: "running",
    environment,
    callerId,
    targetId,
    remoteTransport: !!remoteApi,
  };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const save = () =>
    writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2), {
      mode: 0o600,
    });
  async function json(method, path, body, base = api) {
    const response = await fetch(`${base.replace(/\/$/u, "")}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    // Never retry mutations: an uncertain response can hide a successful Run start.
    assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`);
    return response.json();
  }
  try {
    const marker = `REMOTE_SMOKE_${randomUUID()}`;
    report.marker = marker;
    const session = await json("POST", "/sessions", {
      agent_id: callerId,
      environment,
      title: "Remote Agent smoke",
    });
    report.sessionId = session.id;
    await save();
    const started = await json("POST", `/sessions/${session.id}/runs`, {
      input: `Ask musedam to reply with exactly ${marker}. Do not access assets, files or external tools. Return the actual remote result.`,
      stream: false,
    });
    report.runId = started.id;
    await save();
    const deadline = Date.now() + 240_000;
    let parent;
    while (Date.now() < deadline) {
      parent = await json("GET", `/runs/${started.id}`);
      if (parent.status === "finished") break;
      assert.ok(
        ["queued", "running", "waiting"].includes(parent.status),
        `Parent Run failed: ${parent.status}`,
      );
      await delay(1500);
    }
    assert.equal(
      parent.status,
      "finished",
      `Timed out: inspect Run ${started.id}; no replacement was started`,
    );
    const parentMessages = (
      await json("GET", `/sessions/${session.id}/messages?limit=100`)
    ).items;
    report.parent = parent;
    report.parentMessages = parentMessages;
    await save();
    const receipt = findRemoteReceipt(parentMessages);
    report.receipt = receipt;
    await save();
    const [child, childSession, childMessages] = await Promise.all([
      json("GET", `/runs/${receipt.runId}`, undefined, remoteApi ?? api),
      json(
        "GET",
        `/sessions/${receipt.sessionId}`,
        undefined,
        remoteApi ?? api,
      ),
      json(
        "GET",
        `/sessions/${receipt.sessionId}/messages?limit=100`,
        undefined,
        remoteApi ?? api,
      ),
    ]);
    Object.assign(report, {
      child,
      childSession,
      childMessages: childMessages.items,
      remoteTransport: !!remoteApi,
    });
    await save();
    checkEvidence({
      targetAgentId: targetId,
      marker,
      parent,
      receipt,
      parentMessages,
      child,
      childSession,
      childMessages: childMessages.items,
      remoteTransport: !!remoteApi,
    });
    report.status = "passed";
    await save();
    console.log(
      JSON.stringify(
        {
          status: "passed",
          environment,
          parentRunId: parent.id,
          childRunId: child.id,
          targetId,
          marker,
          report: `${directory}/report.json`,
        },
        null,
        2,
      ),
    );
    return report;
  } catch (error) {
    report.status = "failed";
    report.error = error.message;
    await save();
    throw error;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (existsSync(".env")) process.loadEnvFile(".env");
  await verify({
    api: process.env.GEA_AGENTS_API_URL,
    token: process.env.GEA_ACCESS_TOKEN,
    callerId: process.env.GEA_AGENT_ID,
    targetId: process.env.GEA_REMOTE_AGENT_ID,
    environment: process.env.GEA_ENVIRONMENT ?? "production",
    directory: `.gea/verification/${randomUUID()}`,
  });
}
