import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, symlink, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { geaInstallation } from "@gea-ai/cli/runtime";
import target from "../subagents/musedam.ts";
import { verify } from "./verify.mjs";

if (existsSync(".env")) process.loadEnvFile(".env");
const token = process.env.GEA_ACCESS_TOKEN;
const clientId = process.env.GEA_LOCAL_OAUTH_CLIENT_ID;
const issuer = process.env.GEA_LOCAL_OAUTH_BASE_URL ?? "https://musegea.com";
const remoteEnvironment =
  process.env.GEA_REMOTE_ENVIRONMENT ?? target.environment;
assert.ok(
  token && clientId,
  "Set a user OAuth access token and its OAuth Client ID",
);
assert.ok(["preview", "production"].includes(remoteEnvironment));
const issuerUrl = new URL(issuer);
assert.equal(issuerUrl.protocol, "https:");
assert.equal(
  issuerUrl.href,
  `${issuerUrl.origin}/`,
  "Use an HTTPS issuer origin",
);

const root = path.resolve(".gea/local-to-hosted", randomUUID());
await mkdir(path.join(root, "subagents"), { recursive: true, mode: 0o700 });
await symlink(
  path.resolve("node_modules"),
  path.join(root, "node_modules"),
  "dir",
);
for (const file of ["package.json", "agent.ts", "AGENTS.md"])
  await copyFile(file, path.join(root, file));
// Only the caller is packaged. There is no fixture target in this project.
await writeFile(
  path.join(root, "subagents/musedam.ts"),
  `import { defineRemoteAgent } from "@gea-ai/agent-sdk";\nexport default defineRemoteAgent(${JSON.stringify({ agentId: target.agentId, description: target.description, environment: remoteEnvironment, invocationAuthority: "oauth" })});\n`,
);
const probe = createServer();
probe.listen(0, "127.0.0.1");
await once(probe, "listening");
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
// The OAuth bearer belongs to the HTTP caller, not the Worker build environment.
const { GEA_ACCESS_TOKEN: _token, ...runtimeEnvironment } = process.env;
const child = spawn(
  geaInstallation().cli,
  [
    "agent",
    "dev",
    "--json",
    JSON.stringify({ cwd: root, port, modelSource: "hosted" }),
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...runtimeEnvironment,
      GEA_APP_SERVER_STATE_DIR: path.join(root, "state"),
      GEA_LOCAL_API_AUTH: "1",
      GEA_LOCAL_OAUTH_CLIENT_ID: clientId,
      GEA_LOCAL_OAUTH_BASE_URL: issuerUrl.origin,
    },
  },
);
let log = "";
let spawnError;
child.on("error", (error) => {
  spawnError = error;
});
for (const stream of [child.stdout, child.stderr])
  stream.on("data", (chunk) => {
    log += chunk.toString();
  });
try {
  const deadline = Date.now() + 90000;
  let api;
  while (!api && Date.now() < deadline) {
    if (spawnError) throw spawnError;
    assert.ok(
      child.exitCode === null && child.signalCode === null,
      `Dev exited; inspect ${root}/dev.log`,
    );
    api = log.match(/Agents API: (http:\/\/[^\s]+)/u)?.[1];
    if (!api) await delay(250);
  }
  assert.ok(api, `Dev did not become ready; inspect ${root}/dev.log`);
  const discovery = await fetch(`${api}/agents?environment=local`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(discovery.ok, `Local OAuth admission: HTTP ${discovery.status}`);
  const agents = (await discovery.json()).items;
  assert.equal(agents.length, 1, "Only the local caller may be registered");
  assert.equal(agents[0].name, "remote-agent-caller");
  await writeFile(
    path.join(root, "setup.json"),
    JSON.stringify(
      {
        callerApi: api,
        callerId: agents[0].id,
        remoteApi: `${issuerUrl.origin}/api/v1`,
        targetId: target.agentId,
        remoteEnvironment,
        authority: "oauth",
        clientId,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  await verify({
    api,
    token,
    callerId: agents[0].id,
    targetId: target.agentId,
    environment: "local",
    remoteApi: `${issuerUrl.origin}/api/v1`,
    directory: path.join(root, "evidence"),
  });
} finally {
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    const stopped = once(child, "exit");
    child.kill("SIGINT");
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    await stopped;
    clearTimeout(timer);
  }
  await writeFile(path.join(root, "dev.log"), log, { mode: 0o600 });
}
