import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  copyFile,
  mkdir,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { geaInstallation } from "@gea-ai/cli/runtime";
import { verify } from "./verify.mjs";

// A self-contained local ID-transport check. It does not impersonate a hosted
// OAuth caller or claim to validate cross-tenant installation/authorization.
const root = path.resolve(".gea/local-remote-smoke", randomUUID());
await mkdir(path.join(root, "agents/remote-smoke-target"), {
  recursive: true,
  mode: 0o700,
});
await mkdir(path.join(root, "subagents"), { recursive: true });
try {
  await symlink(
    path.resolve("node_modules"),
    path.join(root, "node_modules"),
    "dir",
  );
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
await copyFile("package.json", path.join(root, "package.json"));
await copyFile("agent.ts", path.join(root, "agent.ts"));
await copyFile("AGENTS.md", path.join(root, "AGENTS.md"));
await writeFile(
  path.join(root, "agents/remote-smoke-target/agent.ts"),
  `import {defineAgent} from "@gea-ai/agent-sdk";
import {agentCore} from "@gea-ai/agent-sdk/agent-core";
export default defineAgent({engine:agentCore(),name:"remote-smoke-target",slug:"remote-smoke-target",model:"creative-reasoning-1.5",maxOutputTokens:512,computer:{enabled:false}});\n`,
);
await writeFile(
  path.join(root, "agents/remote-smoke-target/AGENTS.md"),
  "Reply with exactly the marker requested by the user. Do not delegate or use external tools.\n",
);
const reference = (id) => `import {defineRemoteAgent} from "@gea-ai/agent-sdk";
export default defineRemoteAgent({agentId:${JSON.stringify(id)},description:"Remote smoke target selected by canonical ID",environment:"local"});\n`;
// Discovery happens before invocation. A placeholder is never executed.
await writeFile(
  path.join(root, "subagents/musedam.ts"),
  reference("00000000-0000-4000-8000-000000000001"),
);
const { cli } = geaInstallation();
const portProbe = createServer();
portProbe.listen(0, "127.0.0.1");
await once(portProbe, "listening");
const port = portProbe.address().port;
await new Promise((resolve) => portProbe.close(resolve));
let child;
let log = "";
let logChunks = [];
const logFile = path.join(root, "dev.log");
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const stopped = once(child, "exit");
  child.kill("SIGINT");
  let timer;
  await Promise.race([
    stopped,
    new Promise((resolve) => {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 15000);
    }),
  ]);
  clearTimeout(timer);
}
async function start() {
  log = "";
  child = spawn(
    cli,
    [
      "agent",
      "dev",
      "--json",
      JSON.stringify({ cwd: root, port, modelSource: "hosted" }),
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        GEA_APP_SERVER_STATE_DIR: path.join(root, "state"),
      },
    },
  );
  child.on("error", (error) => {
    log += `\n${error.message}`;
  });
  const collect = (chunk) => {
    const text = chunk.toString();
    log += text;
    logChunks.push(text);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const api = log.match(/Agents API: (http:\/\/[^\s]+)/u)?.[1];
    const keyFile = log.match(/Project API key file: ([^\r\n]+)/u)?.[1];
    if (api && keyFile) {
      const token = (await readFile(keyFile, "utf8")).trim();
      const response = await fetch(`${api}/agents?environment=local`, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10000),
      });
      assert.ok(response.ok, `Discovery returned HTTP ${response.status}`);
      return { api, token, agents: (await response.json()).items };
    }
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(
        `Local dev exited (${child.exitCode ?? child.signalCode}); inspect ${logFile}`,
      );
    await delay(250);
  }
  throw new Error(`Local dev did not become ready; inspect ${logFile}`);
}
try {
  const bootstrap = await start();
  const target = bootstrap.agents.find(
    (agent) => agent.name === "remote-smoke-target",
  );
  assert.ok(target, "Target must be discoverable");
  await stop();
  await writeFile(
    path.join(root, "subagents/musedam.ts"),
    reference(target.id),
  );
  const ready = await start();
  const caller = ready.agents.find(
    (agent) => agent.name === "remote-agent-caller",
  );
  assert.ok(caller, "Caller must be discoverable");
  assert.notEqual(caller.id, target.id);
  await verify({
    api: ready.api,
    token: ready.token,
    callerId: caller.id,
    targetId: target.id,
    environment: "local",
    directory: path.join(root, "evidence"),
  });
} finally {
  await stop();
  await writeFile(logFile, logChunks.join(""), { mode: 0o600 });
}
