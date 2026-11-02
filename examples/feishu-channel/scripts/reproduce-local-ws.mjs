// Local CLI regression probe (published or explicitly supplied source build).
// Disposable project, real SDK/SQLite, loopback only. No Feishu credentials,
// provider socket or model execution. Opt in to the currently blocked lifecycle
// gate with GEA_WS_CHECK_CONVERGENCE=1; failures remain nonzero.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { chmod, mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const example = fileURLToPath(new URL("../", import.meta.url));
const cli = process.env.GEA_CLI_BIN || "gea";
const checkConvergence = process.env.GEA_WS_CHECK_CONVERGENCE === "1";
const root = await mkdtemp(path.join(tmpdir(), "opengea-channel-ws-261102-"));
await chmod(root, 0o700);
const project = path.join(root, "project");
await mkdir(path.join(project, "channels"), { recursive: true });
await symlink(path.join(example, "node_modules"), path.join(project, "node_modules"), "dir");
await writeFile(path.join(project, "package.json"), JSON.stringify({
  name: "local-channel-repro", type: "module",
  dependencies: { "@gea-ai/agent-sdk": "0.1.261102-alpha.1", zod: "4.6.5" },
}));
await writeFile(path.join(project, "AGENTS.md"), "Synthetic local test; no model requests.\n");
await writeFile(path.join(project, "agent.ts"), `
import { defineAgent } from "@gea-ai/agent-sdk";
export default defineAgent({name:"local-channel-repro",slug:"local-channel-repro",model:"fixture",computer:{enabled:false}});
`);
await writeFile(path.join(project, "channels/probe.ts"), `
import { defineChannel, POST, WS } from "@gea-ai/agent-sdk/channels";
export default defineChannel({key:"probe",path:"/probe",${checkConvergence ? 'receiver:{kind:"websocket",version:1,start(){}},' : ""}routes:[
  WS("/socket",{message(socket,data){socket.send("A:"+data)}}),
  POST("/event",async(request,ctx)=>{
    const {id}=await request.json();
    return Response.json(await ctx.event("room",{principalType:"user",principalId:"synthetic"},{operationId:id})
      .reject("feedback",{text:"first-result"}));
  })
],outbound(){return {status:"sent"}}});
`);

const listener = net.createServer();
listener.listen(0, "127.0.0.1");
await once(listener, "listening");
const { port } = listener.address();
await new Promise((resolve) => listener.close(resolve));
const config = path.join(root, "dev.json");
await writeFile(config, JSON.stringify({ cwd: project, host: "127.0.0.1", port,
  trace: false, vite: false, modelSource: "local" }));
const env = {
  PATH: process.env.PATH, TMPDIR: tmpdir(),
  GEA_CONFIG_DIR: path.join(root, "config"),
  GEA_APP_SERVER_STATE_DIR: path.join(root, "server"),
  GEA_BASE_URL: "http://127.0.0.1:9", GEA_APP_URL: "http://127.0.0.1:9",
  GEA_LOCAL_API_AUTH: "0", TEST_CHANNEL_KEY: "synthetic-local-only",
  TEST_CHANNEL_URL: "http://127.0.0.1:9/v1",
  LLM_MODEL_CATALOG_JSON: JSON.stringify({ default: "fixture", pricing: {},
    models: [{ id: "fixture", target: "fixture/model" }],
    providers: { fixture: { type: "openai-compatible", apiKeyEnv: "TEST_CHANNEL_KEY", baseURLEnv: "TEST_CHANNEL_URL" } },
  }),
};
const sdk = JSON.parse(await readFile(path.join(example, "node_modules/@gea-ai/agent-sdk/package.json"), "utf8")).version;
const version = execFileSync(cli, ["--version"], { env, encoding: "utf8" }).trim();
assert.equal(version, process.env.GEA_EXPECT_CLI_VERSION || "0.2.261102-alpha.0");
assert.equal(sdk, "0.1.261102-alpha.1");
const child = spawn(cli, ["agent", "dev", "--json-file", config], {
  env, cwd: project, stdio: ["ignore", "pipe", "pipe"],
});
const exited = once(child, "exit");
let logs = "";
child.stdout.on("data", (chunk) => { logs += chunk; });
child.stderr.on("data", (chunk) => { logs += chunk; });
const evidence = { cli: version, sdk, cliSource: process.env.GEA_CLI_SOURCE_SHA || "published", checkConvergence, results: {} };
let liveSocket;
const send = async (id) => {
  const response = await fetch(`http://127.0.0.1:${port}/probe/event`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }), signal: AbortSignal.timeout(2000),
  });
  return { status: response.status, body: await response.json() };
};
function handshake(route) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1");
    let response = "";
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; socket.destroy(); }, 5000);
    socket.on("connect", () => socket.write(
      `GET ${route} HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n`,
    ));
    socket.on("data", (data) => { response += data.toString(); if (response.includes("\r\n\r\n")) socket.destroy(); });
    socket.on("error", reject);
    socket.on("close", () => { clearTimeout(timer); resolve({ timedOut, statusLine: response.split("\r\n")[0], responseBytes: Buffer.byteLength(response) }); });
  });
}
function processTree() {
  return execFileSync("ps", ["-Ao", "pid=,ppid=,comm="], { encoding: "utf8" })
    .trim().split("\n").map((line) => {
      const [, pid, parent, command] = line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/);
      return { pid: Number(pid), parent: Number(parent), command };
    });
}
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error("CLI exited before readiness; inspect private CLI log.");
    try { ready = (await send("readiness")).status === 200; } catch { /* Listener not ready yet. */ }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "local HTTP Channel did not become ready");
  evidence.results.firstEvent = await send("event-1");
  evidence.results.repeatedEvent = await send("event-1");
  assert.deepEqual(evidence.results.firstEvent, { status: 200, body: { decision: "rejected", duplicate: false } });
  assert.deepEqual(evidence.results.repeatedEvent, { status: 200, body: { decision: "rejected", duplicate: true } });
  evidence.results.declaredSocket = await handshake("/probe/socket");
  evidence.results.absentSocket = await handshake("/absent");
  assert.match(evidence.results.declaredSocket.statusLine, /^HTTP\/1\.1 101\b/, "declared WS route must complete its handshake");
  assert.match(evidence.results.absentSocket.statusLine, /^HTTP\/1\.1 404\b/, "unknown WS route must return 404");
  liveSocket = new WebSocket(`ws://127.0.0.1:${port}/probe/socket`);
  await once(liveSocket, "open", { signal: AbortSignal.timeout(10000) });
  const echo = async (text) => {
    const received = once(liveSocket, "message", { signal: AbortSignal.timeout(10000) });
    liveSocket.send(text);
    return (await received)[0].data;
  };
  assert.equal(await echo("before"), "A:before");
  evidence.results.socketEcho = "A:before";
  if (checkConvergence) {
    const channelFile = path.join(project, "channels/probe.ts");
    await writeFile(channelFile, (await readFile(channelFile, "utf8")).replace('"A:"', '"B:"'));
    let switched = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (await echo("after") === "B:after") { switched = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(switched, "open socket must dispatch to the new deployment after rebuild");
    assert.equal(liveSocket.readyState, WebSocket.OPEN);
    evidence.results.convergedSocket = { before: "A:before", after: "B:after", sameSocket: true };
    evidence.results.repeatedAfterConverge = await send("event-1");
    assert.deepEqual(evidence.results.repeatedAfterConverge, { status: 200, body: { decision: "rejected", duplicate: true } });
  }
} catch (error) {
  evidence.failure = error.message;
  const convergeFailure = logs.match(/HTTP status client error \((\d+) [^)]*\) for url \(http:\/\/127\.0\.0\.1:\d+\/_gea\/runtime\/channel-object\/converge\)/);
  if (convergeFailure) evidence.convergeStatus = Number(convergeFailure[1]);
  process.exitCode = 1;
} finally {
  liveSocket?.close();
  // Native services use separate process groups. Capture only this invocation's
  // descendants before the launcher exits; never kill by a global process name.
  const processes = processTree();
  const owned = new Set([child.pid]);
  for (let changed = true; changed;) {
    changed = false;
    for (const entry of processes) if (owned.has(entry.parent) && !owned.has(entry.pid)) {
      owned.add(entry.pid); changed = true;
    }
  }
  const descendants = processes.filter((entry) => owned.has(entry.pid) && entry.pid !== child.pid);
  child.kill("SIGINT");
  const timeout = setTimeout(() => child.kill("SIGTERM"), 15000);
  await exited;
  clearTimeout(timeout);
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    const current = processTree();
    for (const entry of descendants) if (current.some((p) => p.pid === entry.pid && p.command === entry.command)) {
      try { process.kill(entry.pid, signal); } catch (error) { if (error.code !== "ESRCH") throw error; }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  evidence.remainingOwnedProcesses = processTree().filter((entry) =>
    descendants.some((p) => p.pid === entry.pid && p.command === entry.command)).length;
  await writeFile(path.join(root, "cli.log"), logs, { mode: 0o600 });
  await writeFile(path.join(root, "result.json"), JSON.stringify(evidence, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ evidenceDirectory: root, ...evidence }, null, 2));
}
