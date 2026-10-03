import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

if (existsSync(".env")) process.loadEnvFile(".env");
const agentId = process.env.GEA_AGENT_ID;
const project = process.env.GEA_PROJECT;
assert.ok(project, "Set GEA_PROJECT to the Studio Project slug for trace inspection");
const environment = process.env.GEA_ENVIRONMENT || "production";
assert.ok(agentId, "Set GEA_AGENT_ID to this example's hosted Agent UUID");
assert.ok(["preview", "production"].includes(environment));
const directory = resolve(process.env.GEA_VERIFY_DIR || `.gea/verification/${Date.now()}`);
await mkdir(directory, { recursive: true, mode: 0o700 });
const execute = promisify(execFile);
async function cli(command, input) {
  const { stdout } = await execute("gea", [...command, "--json", JSON.stringify(input)], {
    maxBuffer: 32 * 1024 * 1024,
    timeout: 60_000,
  });
  return JSON.parse(stdout);
}
async function save(name, data) {
  await writeFile(`${directory}/${name}.json`, JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
  });
}
const cases = [
  {
    name: "inventory",
    prompt:
      "Using the synthetic warehouse tools, discover the available operations and inspect their input schemas. List the warehouses, read their inventories concurrently, and compute total units and total inventory value in USD cents. Return compact JSON with warehouses, totalUnits, totalValueCents. Use real tool results; do not infer the numbers.",
  },
  {
    name: "boundaries",
    prompt:
      "Verify the code mode exposure boundary with harmless reads. In executeJavaScript inspect ALL_TOOLS, searchTools with namespace tools and limit 20, and describeNamespace('tools'). Confirm privateCanary is absent from all discovery results and describeTool('privateCanary') returns undefined. Attempt tools['privateCanary']({}) and catch the error; then discover the inventory reader and invoke it with warehouse='invalid', catching that validation error. Finally make a valid north inventory read to show the errors did not break subsequent calls. Return one JSON object directly from the script with catalogNames (array of names), hiddenAbsent (boolean), hiddenError (caught message), invalidInputError (caught message), and north (the real inventory result). Do not manufacture errors or retry failed scripts.",
  },
];
const report = {
  startedAt: new Date().toISOString(),
  agentId,
  environment,
  project,
  sdk: JSON.parse(await readFile("node_modules/@gea-ai/agent-sdk/package.json", "utf8")).version,
  cli: JSON.parse(await readFile("node_modules/@gea-ai/cli/package.json", "utf8")).version,
  lockfileSha256: createHash("sha256")
    .update(await readFile("pnpm-lock.yaml"))
    .digest("hex"),
  status: "running",
  cases: [],
};
if (existsSync(`${directory}/report.json`)) {
  const previous = JSON.parse(await readFile(`${directory}/report.json`, "utf8"));
  assert.equal(previous.agentId, agentId);
  assert.equal(previous.environment, environment);
  assert.equal(previous.project ?? project, project);
  report.startedAt = previous.startedAt;
  report.cases = previous.cases;
}
await save("report", report);
console.log(`Evidence: ${directory}`);
try {
  for (const test of cases) {
    const startPath = `${directory}/${test.name}-start.json`;
    let started;
    if (existsSync(startPath)) {
      started = JSON.parse(await readFile(startPath, "utf8"));
      assert.equal(started.agentId, agentId, "Cannot resume a different Agent");
    } else {
      const pending = `${directory}/${test.name}-pending.json`;
      assert.ok(
        !existsSync(pending),
        "An earlier start has an uncertain outcome. Inspect Studio; do not replay the write.",
      );
      await save(`${test.name}-pending`, { agentId, environment, prompt: test.prompt });
      started = await cli(["agent", "run"], { agentId, environment, prompt: test.prompt });
      await save(`${test.name}-start`, started);
    }
    console.log(`${test.name}: ${started.agentRunId}`);
    const deadline = Date.now() + 180_000;
    let chat;
    do {
      // The public Chat projection can briefly be absent after Run acceptance.
      chat = await cli(["chat", "get"], { id: started.chatId });
      await save(`${test.name}-chat`, chat);
      if (chat?.latestRunStatus === "finished") break;
      assert.ok(
        chat === null || ["queued", "running"].includes(chat.latestRunStatus),
        `Run stopped: ${chat?.latestRunStatus}`,
      );
      assert.ok(
        Date.now() < deadline,
        `Run still active: ${started.agentRunId}. Resume with GEA_VERIFY_DIR=${directory}; do not start another run.`,
      );
      await setTimeout(3000);
    } while (true);
    const messages = await cli(["chat", "export"], { chatId: started.chatId });
    await save(`${test.name}-messages`, messages);
    const assistant = messages.filter(
      (m) => m.agentRunId === started.agentRunId && m.content.role === "assistant",
    );
    const parts = assistant.flatMap((m) => m.content.parts);
    const calls = parts.filter((p) => p.type === "tool-executeJavaScript");
    assert.ok(calls.length, "No real executeJavaScript call recorded");
    assert.ok(
      calls.every((p) => p.state === "output-available" && !p.output.error && !p.output.truncated),
      "Script failed or output truncated",
    );
    assert.ok(
      !parts.some((p) =>
        ["tool-listWarehouses", "tool-readInventory", "tool-privateCanary"].includes(p.type),
      ),
      "Discoverable/hidden tools must not be top-level model calls",
    );
    const source = calls.map((p) => p.input.code).join("\n");
    const values = calls.map((p) => {
      if (typeof p.output.value !== "string") return p.output.value;
      try {
        return JSON.parse(p.output.value);
      } catch {
        return p.output.value;
      }
    });
    if (test.name === "inventory") {
      assert.match(source, /searchTools/);
      assert.match(source, /describeTool/);
      assert.match(source, /Promise\.all/);
      assert.match(source, /readInventory/);
      assert.ok(
        values.some((v) => v?.totalUnits === 32 && v?.totalValueCents === 7800),
        "Actual script result must contain correct totals",
      );
    } else {
      assert.match(source, /ALL_TOOLS/);
      assert.match(source, /describeNamespace/);
      const result = values.find((v) => v?.hiddenAbsent === true);
      assert.ok(result, "Missing script boundary evidence");
      assert.deepEqual([...result.catalogNames].sort(), ["listWarehouses", "readInventory"]);
      assert.match(result.hiddenError, /not a function|unknown|not.*(available|found|allowed)/i);
      assert.match(result.invalidInputError, /invalid|validation|warehouse|enum/i);
      assert.equal(result.north.warehouse, "north");
      assert.equal(
        result.north.items.reduce((n, i) => n + i.units, 0),
        19,
      );
      assert.ok(!JSON.stringify(values).includes("HIDDEN_TOOL_EXECUTED"));
    }
    const traceIds = [...new Set(assistant.map((m) => m.metadata?.trace?.traceId).filter(Boolean))];
    assert.ok(traceIds.length, "Missing trace reference");
    const spans = [];
    for (const traceId of traceIds) {
      let cursor;
      let pageNumber = 0;
      do {
        const page = await cli(["trace", "inspect"], {
          project,
          traceId,
          ...(cursor ? { cursor } : {}),
        });
        await save(`${test.name}-trace-${traceId}-${pageNumber++}`, page);
        spans.push(
          ...(page.data.resourceSpans ?? []).flatMap((r) =>
            (r.scopeSpans ?? []).flatMap((s) => s.spans ?? []),
          ),
        );
        cursor = page.nextCursor;
        assert.ok(pageNumber < 50, "Unexpected trace pagination size");
      } while (cursor);
    }
    const attribute = (span, key) =>
      span.attributes?.find((a) => a.key === key)?.value?.stringValue;
    const models = [
      ...new Set(spans.map((s) => attribute(s, "gen_ai.request.model")).filter(Boolean)),
    ];
    assert.ok(models.length, "Missing real model spans");
    const toolSpans = spans.filter((s) => s.name.startsWith("execute_tool "));
    assert.ok(
      !toolSpans.some((s) => s.name === "execute_tool privateCanary"),
      "Hidden tool executed",
    );
    const scriptIds = new Set(
      toolSpans.filter((s) => s.name === "execute_tool executeJavaScript").map((s) => s.spanId),
    );
    const nested = toolSpans.filter(
      (s) => s.name === "execute_tool readInventory" && scriptIds.has(s.parentSpanId),
    );
    assert.ok(nested.length, "Missing actual inventory calls nested under executeJavaScript");
    if (test.name === "inventory") {
      const warehouses = nested.map(
        (s) => JSON.parse(attribute(s, "gen_ai.tool.call.result")).warehouse,
      );
      assert.deepEqual([...new Set(warehouses)].sort(), ["north", "south"]);
    }
    report.cases = report.cases.filter((entry) => entry.name !== test.name);
    report.cases.push({
      name: test.name,
      ...started,
      scriptCalls: calls.length,
      traceIds,
      models,
      nestedInventoryCalls: nested.length,
      passed: true,
    });
    await save("report", report);
  }
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  await save("report", report);
  throw error;
}
report.status = "passed";
report.finishedAt = new Date().toISOString();
await save("report", report);
console.log(
  "Passed: real hosted model discovery, concurrent inventory reads, totals, hidden-tool rejection and input validation.",
);
