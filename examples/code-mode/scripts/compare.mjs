import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout } from "node:timers/promises";
import { promisify } from "node:util";

if (existsSync(".env")) process.loadEnvFile(".env");
const project = process.env.GEA_PROJECT;
const environment = process.env.GEA_ENVIRONMENT || "production";
const ids = {
  code: process.env.GEA_CODE_AGENT_ID,
  direct: process.env.GEA_DIRECT_AGENT_ID,
  ...(process.env.GEA_SKILL_AGENT_ID
    ? { skill: process.env.GEA_SKILL_AGENT_ID }
    : {}),
};
assert.ok(
  project && ids.code && ids.direct,
  "Set GEA_PROJECT, GEA_CODE_AGENT_ID and GEA_DIRECT_AGENT_ID",
);
assert.ok(["preview", "production"].includes(environment));
const directory = resolve(
  process.env.GEA_COMPARE_DIR || `.gea/comparison/${Date.now()}`,
);
await mkdir(directory, { recursive: true, mode: 0o700 });
const execute = promisify(execFile);
async function cli(command, input) {
  const { stdout } = await execute(
    "gea",
    [...command, "--json", JSON.stringify(input)],
    {
      maxBuffer: 64 * 1024 * 1024,
      timeout: 60_000,
    },
  );
  return JSON.parse(stdout);
}
async function save(name, value) {
  await writeFile(
    `${directory}/${name}.json`,
    JSON.stringify(value, null, 2) + "\n",
    {
      mode: 0o600,
    },
  );
}
const prompt =
  "Create a report from all synthetic order pages and the custom discount policy. Include only paid orders. Apply each region's discount per order, flooring the net cents before summing. Return JSON only: {regions:{north:{paidOrders,units,grossCents,netCents},south:{paidOrders,units,grossCents,netCents}},totals:{paidOrders,units,grossCents,netCents}}. Read each page once, use real tool results, and omit raw orders from the final answer.";
const boundaryPrompt =
  "Check the remote orders MCP protocol in executeJavaScript. Discover tools and inspect descriptions for read_order_page and lookup_order. Read page 1 and return evidence that its MCP content text JSON equals structuredContent, isError is false, and _meta.dataset survives. Look up ORDER-001 and verify it is text-only without structuredContent. Look up a missing ID and verify the original isError=true envelope and ORDER_NOT_FOUND text survive. Wait for the missing-order lookup to finish, inspect isError, and only THEN issue the page 2 read. Do not put the missing lookup and page 2 in the same Promise.all or start page 2 before receiving the missing result. Await both describeTool calls; they return strings, not objects with a description property. Return a single complete object directly from the final script with these exact types: envelopeMatches:boolean, metadataPreserved:boolean (compare _meta.dataset === synthetic-orders-v1), textOnly:boolean, remoteError:{isError:boolean,text:string}, recoveredPage:number, descriptions:{page:string,lookup:string}. Each boolean must be computed from the real result. Descriptions must be the full resolved strings in that same object. Do not fabricate evidence or return raw order pages.";
const cases = [
  { name: "code", agentId: ids.code, prompt },
  { name: "direct", agentId: ids.direct, prompt },
  ...(ids.skill ? [{ name: "skill", agentId: ids.skill, prompt }] : []),
  { name: "mcp-boundaries", agentId: ids.code, prompt: boundaryPrompt },
];
const report = {
  inspectedAt: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  sdk: JSON.parse(
    await readFile("node_modules/@gea-ai/agent-sdk/package.json", "utf8"),
  ).version,
  cli: JSON.parse(
    await readFile("node_modules/@gea-ai/cli/package.json", "utf8"),
  ).version,
  mcpSdk: JSON.parse(
    await readFile(
      "node_modules/@modelcontextprotocol/sdk/package.json",
      "utf8",
    ),
  ).version,
  project,
  environment,
  ids,
  skillScriptSha256: createHash("sha256")
    .update(
      await readFile(
        new URL(
          "../agents/orders-skill/skills/orders-report/scripts/summarize.js",
          import.meta.url,
        ),
      ),
    )
    .digest("hex"),
  status: "running",
  cases: [],
  lockfileSha256: createHash("sha256")
    .update(await readFile("pnpm-lock.yaml"))
    .digest("hex"),
};
if (existsSync(`${directory}/report.json`)) {
  const previous = JSON.parse(
    await readFile(`${directory}/report.json`, "utf8"),
  );
  assert.deepEqual(previous.ids, ids);
  assert.equal(previous.environment, environment);
  assert.equal(previous.project, project);
}
await save("report", report);
console.log(`Evidence: ${directory}`);
const stringAttr = (span, key) =>
  span.attributes?.find((a) => a.key === key)?.value?.stringValue;
const intAttr = (span, key) => {
  const value = span.attributes?.find((a) => a.key === key)?.value?.intValue;
  assert.notEqual(value, undefined, `Missing trace usage field: ${key}`);
  return Number(value);
};
const parseJson = (text) =>
  JSON.parse(
    text
      .trim()
      .replace(/^```(?:json)?\s*/u, "")
      .replace(/\s*```$/u, ""),
  );
try {
  for (const test of cases) {
    let started;
    if (existsSync(`${directory}/${test.name}-start.json`)) {
      started = JSON.parse(
        await readFile(`${directory}/${test.name}-start.json`, "utf8"),
      );
      assert.equal(started.agentId, test.agentId);
    } else {
      assert.ok(
        !existsSync(`${directory}/${test.name}-pending.json`),
        "Unknown start outcome: inspect Studio and recover the existing Run; do not replay.",
      );
      await save(`${test.name}-pending`, {
        agentId: test.agentId,
        environment,
        prompt: test.prompt,
      });
      started = await cli(["agent", "run"], {
        agentId: test.agentId,
        environment,
        prompt: test.prompt,
      });
      await save(`${test.name}-start`, started);
    }
    console.log(`${test.name}: ${started.agentRunId}`);
    const deadline = Date.now() + 300_000;
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
        `Run still active. Resume with GEA_COMPARE_DIR=${directory}; do not repost it.`,
      );
      await setTimeout(3000);
    } while (true);
    const messages = await cli(["chat", "export"], { chatId: started.chatId });
    await save(`${test.name}-messages`, messages);
    const assistant = messages.filter(
      (m) =>
        m.agentRunId === started.agentRunId && m.content.role === "assistant",
    );
    const parts = assistant.flatMap((m) => m.content.parts);
    const calls = parts.filter(
      (p) => p.type.startsWith("tool-") || p.type === "dynamic-tool",
    );
    const scripts = calls.filter((p) => p.type === "tool-executeJavaScript");
    const traceIds = [
      ...new Set(
        assistant.map((m) => m.metadata?.trace?.traceId).filter(Boolean),
      ),
    ];
    assert.ok(traceIds.length, "Missing trace reference");
    const spans = [];
    for (const traceId of traceIds) {
      let cursor;
      let count = 0;
      do {
        const page = await cli(["trace", "inspect"], {
          project,
          traceId,
          ...(cursor ? { cursor } : {}),
        });
        await save(`${test.name}-trace-${count++}`, page);
        spans.push(
          ...(page.data.resourceSpans ?? []).flatMap((r) =>
            (r.scopeSpans ?? []).flatMap((s) => s.spans ?? []),
          ),
        );
        cursor = page.nextCursor;
        assert.ok(count < 100, "Unexpected trace pagination size");
      } while (cursor);
    }
    const models = spans.filter((s) => stringAttr(s, "gen_ai.request.model"));
    assert.ok(models.length, "No actual model request spans");
    const uniqueResults = new Map();
    let toolResultBytesAcrossRequests = 0;
    for (const model of models) {
      const input = JSON.parse(stringAttr(model, "gen_ai.input.messages"));
      for (const message of input) {
        if (!Array.isArray(message.content)) continue;
        for (const part of message.content) {
          if (part.type !== "tool-result") continue;
          const size = Buffer.byteLength(JSON.stringify(part.output));
          uniqueResults.set(part.toolCallId, size);
          toolResultBytesAcrossRequests += size;
        }
      }
    }
    const entry = {
      name: test.name,
      ...started,
      traceIds,
      modelAliases: [
        ...new Set(models.map((s) => stringAttr(s, "gen_ai.request.model"))),
      ],
      modelRequests: models.length,
      modelInputTokens: models.reduce(
        (n, s) => n + intAttr(s, "gen_ai.usage.input_tokens"),
        0,
      ),
      modelOutputTokens: models.reduce(
        (n, s) => n + intAttr(s, "gen_ai.usage.output_tokens"),
        0,
      ),
      modelSpanSeconds: models.reduce(
        (n, s) =>
          n +
          Number(BigInt(s.endTimeUnixNano) - BigInt(s.startTimeUnixNano)) / 1e9,
        0,
      ),
      topLevelToolCalls: calls.length,
      generatedScriptSourceBytes: scripts.reduce(
        (n, s) => n + Buffer.byteLength(s.input?.code ?? ""),
        0,
      ),
      scriptArgumentBytes: scripts.reduce(
        (n, s) => n + Buffer.byteLength(JSON.stringify(s.input)),
        0,
      ),
      skillSourceCalls: scripts.filter((s) => s.input?.skill).length,
      uniqueModelToolResultBytes: [...uniqueResults.values()].reduce(
        (a, b) => a + b,
        0,
      ),
      toolResultBytesAcrossModelRequests: toolResultBytesAcrossRequests,
      passed: false,
    };
    try {
      assert.ok(
        calls.every((p) => p.state === "output-available"),
        "An outer tool call failed",
      );
      assert.ok(
        scripts.every((p) => !p.output.error && !p.output.truncated),
        "A script failed or truncated",
      );
      if (test.name !== "mcp-boundaries") {
        const finalText = parts.filter((p) => p.type === "text").at(-1)?.text;
        assert.ok(finalText, "Missing final answer");
        const result = parseJson(finalText);
        // Independent expected totals are fixed in the verification record.
        const expected = JSON.parse(
          await readFile(
            new URL("./orders-expected.json", import.meta.url),
            "utf8",
          ),
        );
        assert.deepEqual(result, expected, "Incorrect report");
        const pageCalls = spans.filter(
          (s) =>
            s.name.startsWith("execute_tool ") &&
            s.name.endsWith("read_order_page"),
        );
        assert.equal(
          pageCalls.length,
          4,
          "Every remote page must be fetched exactly once",
        );
        assert.deepEqual(
          pageCalls
            .map(
              (s) =>
                JSON.parse(stringAttr(s, "gen_ai.tool.call.arguments")).page,
            )
            .sort(),
          [1, 2, 3, 4],
        );
        assert.ok(
          spans.some((s) => s.name === "execute_tool getDiscountPolicy"),
          "Missing custom policy call",
        );
        if (test.name === "code" || test.name === "skill") {
          const scriptIds = new Set(
            spans
              .filter((s) => s.name === "execute_tool executeJavaScript")
              .map((s) => s.spanId),
          );
          assert.ok(
            pageCalls.every((s) => scriptIds.has(s.parentSpanId)),
            "MCP reads must be nested inside scripts",
          );
          const outputs = scripts.map((s) => s.output);
          const containsRows = (value) => {
            if (typeof value === "string") {
              try {
                return containsRows(JSON.parse(value));
              } catch {
                return false;
              }
            }
            if (!value || typeof value !== "object") return false;
            if (
              typeof value.id === "string" &&
              /^ORDER-\d{3}$/.test(value.id) &&
              "unitPriceCents" in value
            )
              return true;
            return Object.values(value).some(containsRows);
          };
          assert.ok(
            !outputs.some(containsRows),
            "Raw pages leaked back to the model",
          );
          assert.ok(
            scripts.some((s) =>
              JSON.stringify(s.output.value).includes("netCents"),
            ),
            "No computed script summary",
          );
        }
        if (test.name === "skill") {
          assert.equal(
            scripts.length,
            1,
            "The Skill report must execute once by file reference",
          );
          assert.deepEqual(scripts[0].input.skill, {
            name: "orders-report",
            path: "scripts/summarize.js",
          });
          assert.equal(
            scripts[0].input.code,
            undefined,
            "Do not regenerate Skill source inline",
          );
          assert.equal(scripts[0].input.artifactId, undefined);
          const reads = calls.filter((p) => p.type === "tool-loadSkill");
          assert.ok(
            reads.some((p) => p.input.skill === "orders-report"),
            "Read the Skill instructions before executing",
          );
          assert.ok(
            reads.every(
              (p) =>
                p.input.skill === "orders-report" &&
                (!p.input.path || p.input.path === "SKILL.md"),
            ),
            "Do not read script source into model context",
          );
          const source = (
            await readFile(
              new URL(
                "../agents/orders-skill/skills/orders-report/scripts/summarize.js",
                import.meta.url,
              ),
              "utf8",
            )
          ).trim();
          assert.ok(
            models.every(
              (m) =>
                !stringAttr(m, "gen_ai.input.messages").includes(
                  JSON.stringify(source).slice(1, -1),
                ),
            ),
            "Skill source leaked into model input",
          );
        }
        entry.result = result;
      } else {
        const values = scripts.map((s) =>
          typeof s.output.value === "string"
            ? parseJson(s.output.value)
            : s.output.value,
        );
        const result = values.find((v) => v?.envelopeMatches === true);
        assert.ok(result, "No actual envelope evidence");
        assert.equal(result.metadataPreserved, true);
        assert.equal(result.textOnly, true);
        assert.equal(result.remoteError.isError, true);
        assert.match(result.remoteError.text, /ORDER_NOT_FOUND/);
        assert.equal(result.recoveredPage, 2);
        const toolSpans = spans.filter((s) =>
          s.name.startsWith("execute_tool "),
        );
        const missingCall = toolSpans.find(
          (s) =>
            s.name.endsWith("lookup_order") &&
            JSON.parse(stringAttr(s, "gen_ai.tool.call.result") ?? "null")
              ?.isError === true,
        );
        const recoveryCall = toolSpans.find(
          (s) =>
            s.name.endsWith("read_order_page") &&
            JSON.parse(stringAttr(s, "gen_ai.tool.call.arguments") ?? "null")
              ?.page === 2,
        );
        assert.ok(
          missingCall && recoveryCall,
          "Missing actual error/recovery tool spans",
        );
        assert.ok(
          BigInt(recoveryCall.startTimeUnixNano) >=
            BigInt(missingCall.endTimeUnixNano),
          "Recovery read started before the error call settled",
        );
        assert.match(result.descriptions.page, /structuredContent/);
        assert.doesNotMatch(
          result.descriptions.lookup,
          /MCP structuredContent JSON Schema:/,
        );
        entry.result = result;
      }
      entry.passed = true;
    } catch (error) {
      entry.failure = error.message;
    }
    report.cases.push(entry);
    await save("report", report);
    console.log(`${test.name}: ${entry.passed ? "passed" : entry.failure}`);
  }
  report.status = report.cases.every((c) => c.passed) ? "passed" : "failed";
  await save("report", report);
  assert.equal(
    report.status,
    "passed",
    "Comparison has failures; inspect report.json. No Runs were replayed.",
  );
} catch (error) {
  report.status = "failed";
  report.failure = error.message;
  await save("report", report);
  throw error;
}
console.log(
  "Passed: real remote MCP + custom tools, ordinary/code-mode/optional Skill comparison, MCP envelope and error checks.",
);
