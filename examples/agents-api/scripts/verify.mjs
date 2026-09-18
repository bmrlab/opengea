import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

if (existsSync(".env")) process.loadEnvFile(".env");
const api = (
  process.env.GEA_AGENTS_API_URL || "http://127.0.0.1:8795/api/v1"
).replace(/\/$/u, "");
const environment = process.env.GEA_ENVIRONMENT || "local";
assert.ok(
  ["local", "preview", "production"].includes(environment),
  "Invalid GEA_ENVIRONMENT",
);
const url = new URL(api);
assert.ok(
  url.protocol === "https:" ||
    (url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)),
  "Use HTTPS or loopback HTTP",
);
const token = process.env.GEA_ACCESS_TOKEN?.trim();
assert.ok(
  environment === "local" || token,
  "Cloud calls require GEA_ACCESS_TOKEN (Project API Key or user OAuth)",
);
const headers = token ? { Authorization: `Bearer ${token}` } : {};

// Ordinary HTTP calls. Do not retry writes: a failed connection can hide a successful write.
async function request(method, path, body, attempt = 0) {
  const multipart = body instanceof FormData;
  const download =
    method === "GET" && /^\/(files|artifacts)\/[^/]+\/content$/.test(path);
  let response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...headers,
      ...(!multipart && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body:
      body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    redirect: download ? "manual" : "error",
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
  if (download && response.status === 302) {
    const location = response.headers.get("location");
    assert.ok(location, "File download must provide a signed URL");
    const target = new URL(location);
    assert.equal(target.protocol, "https:");
    assert.ok(!target.username && !target.password);
    // The signed object-store URL is its own credential; never forward the API key.
    response = await fetch(target, {
      redirect: "error",
      signal: AbortSignal.timeout(120_000),
    });
  }
  assert.ok(
    response.ok,
    `${method} ${path}: HTTP ${response.status} ${response.ok ? "" : await response.text()}`,
  );
  return response;
}
async function json(method, path, body) {
  return (await request(method, path, body)).json();
}
async function run(sessionId, input) {
  const started = await json("POST", `/sessions/${sessionId}/runs`, {
    input,
    stream: false,
  });
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const current = await json("GET", `/runs/${started.id}`);
    if (current.status === "finished") return current;
    assert.ok(
      ["queued", "running"].includes(current.status),
      `Run ${started.id}: ${current.status}`,
    );
    await setTimeout(environment === "local" ? 500 : 2000);
  }
  throw new Error(
    `Run ${started.id} timed out. Inspect or cancel it with POST /runs/${started.id}/cancel.`,
  );
}

const agents = await json("GET", `/agents?environment=${environment}`);
const agent = agents.items.find((item) =>
  process.env.GEA_AGENT_ID
    ? item.id === process.env.GEA_AGENT_ID
    : item.name === "prepared-workspace",
);
assert.ok(
  agent,
  "Publish/start this example and select its ID with GEA_AGENT_ID",
);
const session = await json("POST", "/sessions", {
  agent_id: agent.id,
  environment,
  title: "Prepared inputs over HTTP",
});
console.log(`Session: ${session.id} (${environment})`);
const computer = `/sessions/${session.id}/computer`;
await json("POST", computer, { operation: "prepare" });
const marker = randomUUID();
const setup = `Prepared before the first Run: ${marker}`;
await json("POST", computer, {
  operation: "write-file",
  path: "setup.txt",
  data_base64: Buffer.from(setup).toString("base64"),
});
const read = await json("POST", computer, {
  operation: "read-file",
  path: "setup.txt",
});
assert.equal(Buffer.from(read.data_base64, "base64").toString(), setup);
const command = await json("POST", computer, {
  operation: "exec",
  command: "cat /workspace/setup.txt",
});
assert.equal(command.stdout, setup);

const source = `Input uploaded separately from Computer: ${marker}`;
const form = new FormData();
if (environment !== "local") form.set("environment", environment);
form.set("file", new File([source], "source.txt", { type: "text/plain" }));
const file = await json("POST", "/files", form);
assert.equal(
  await (await request("GET", `/files/${file.id}/content`)).text(),
  source,
);
const before = await json("GET", `/sessions/${session.id}/messages`);
assert.deepEqual(
  before.items,
  [],
  "Preparation must not run the model or add chat messages",
);
assert.deepEqual(
  (await json("GET", `/sessions/${session.id}/artifacts`)).items,
  [],
  "Input files are not session outputs",
);

const first = await run(session.id, {
  role: "user",
  parts: [
    {
      type: "text",
      text: "Save a prepared report from this attached file using savePreparedReport.",
    },
    { type: "file", file_id: file.id },
  ],
});
const outputs = await json(
  "GET",
  `/sessions/${session.id}/artifacts?run_id=${first.id}`,
);
assert.equal(outputs.items.length, 1, "The Agent must save one report");
const output = outputs.items[0];
const content = await (
  await request("GET", `/files/${output.id}/content`)
).text();
assert.equal(content, `Source:\n${source}\nWorkspace:\n${setup}`);
assert.equal(
  await (await request("GET", `/artifacts/${output.id}/content`)).text(),
  content,
  "file_id and artifact_id address the same stored file",
);

const continuation = await run(
  session.id,
  "Which tool did you use in the previous turn? Reply with its exact name only, without calling tools.",
);
const continued = await json("GET", `/sessions/${session.id}/messages`);
assert.equal(
  continued.items.length,
  4,
  "A second turn must retain the first turn",
);
assert.ok(
  continued.items[0].parts.some(
    (part) => part.type === "text" && part.text.includes("savePreparedReport"),
  ),
  "The Agent must recall its previous tool call",
);

// Reuse the output's ID directly as a file input in a second conversation.
const followup = await json("POST", "/sessions", {
  agent_id: agent.id,
  environment,
  title: "Reuse an output file",
});
await json("POST", `/sessions/${followup.id}/computer`, {
  operation: "write-file",
  path: "setup.txt",
  data_base64: Buffer.from("Second session").toString("base64"),
});
const second = await run(followup.id, {
  role: "user",
  parts: [
    {
      type: "text",
      text: "Save a prepared report from this attached file using savePreparedReport.",
    },
    { type: "file", file_id: output.id },
  ],
});
const reused = await json(
  "GET",
  `/sessions/${followup.id}/artifacts?run_id=${second.id}`,
);
assert.equal(reused.items.length, 1);
assert.equal(
  await (await request("GET", `/files/${reused.items[0].id}/content`)).text(),
  `Source:\n${content}\nWorkspace:\nSecond session`,
);
const latest = await json("GET", `/sessions/${session.id}/messages?limit=1`);
assert.equal(latest.items[0].role, "assistant");
assert.ok(latest.next_cursor, "Older history must be available");
const older = await json(
  "GET",
  `/sessions/${session.id}/messages?limit=100&cursor=${encodeURIComponent(latest.next_cursor)}`,
);
assert.ok(
  older.items.some(
    (message) =>
      message.role === "user" &&
      JSON.stringify(message.parts).includes(file.id),
  ),
);
const connections = await json(
  "GET",
  `/agents/${agent.id}/connections?environment=${environment}`,
);
assert.deepEqual(
  connections.items,
  [],
  "This example has no declared Connectors",
);

await mkdir(".gea", { recursive: true });
const report = {
  verifiedAt: new Date().toISOString(),
  api,
  environment,
  agentId: agent.id,
  sessionId: session.id,
  followupSessionId: followup.id,
  runIds: [first.id, continuation.id, second.id],
  inputFileId: file.id,
  outputFileIds: [output.id, reused.items[0].id],
  marker,
};
await writeFile(
  ".gea/verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  "Passed: session preparation, Computer read/write/exec, upload, real Agent runs, output reuse and paginated history.",
);
console.log(
  "Saved resource IDs to .gea/verification.json; resources remain available for inspection.",
);
