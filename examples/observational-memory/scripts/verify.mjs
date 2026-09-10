import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { startAgent } from "./dev.mjs";
import { runTurn, readContext } from "./client.mjs";
import { turns, question, expected, scoreRecord } from "./scenario.mjs";
import { cacheUsage } from "./metrics.mjs";

const strategies = ["raw", "summary", "observational-memory"];
const { values } = parseArgs({ options: { order: { type: "string" } } });
const modes = values.order?.split(",") ?? strategies;
if (
  modes.length !== 3 ||
  new Set(modes).size !== 3 ||
  modes.some((mode) => !strategies.includes(mode))
)
  throw new Error(
    "--order must contain raw,summary,observational-memory exactly once.",
  );
const id = `${new Date().toISOString().replaceAll(":", "-")}-${randomUUID().slice(0, 8)}`;
const output = `.gea/verification/${id}`;
const sdkPackage = JSON.parse(
  await readFile(
    new URL("../package.json", import.meta.resolve("@gea-ai/agent-sdk")),
    "utf8",
  ),
);
const cliPackage = JSON.parse(
  await readFile(
    new URL(import.meta.resolve("@gea-ai/cli/package.json")),
    "utf8",
  ),
);
const lockfileSha256 = createHash("sha256")
  .update(await readFile("pnpm-lock.yaml"))
  .digest("hex");
await mkdir(output, { recursive: true });
let agent = await startAgent({ quiet: true, port: 0 });
const report = {
  id,
  models: agent.models,
  packages: {
    "@gea-ai/agent-sdk": sdkPackage.version,
    "@gea-ai/cli": cliPackage.version,
  },
  lockfileSha256,
  scenarioTurns: turns.length,
  scenario: {
    sha256: createHash("sha256")
      .update(JSON.stringify({ turns, question }))
      .digest("hex"),
    question,
    expected,
  },
  order: modes,
  modes: {},
  limits:
    "Synthetic conversation and local native Runtime; no hosted deployment or pricing claim.",
};
const hash = (context) =>
  createHash("sha256").update(JSON.stringify(context)).digest("hex");
const save = () =>
  writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
try {
  for (const mode of modes) {
    const chatId = `${id}-${mode}`;
    const runs = [];
    report.modes[mode] = { chatId, runs };
    for (const [index, message] of turns.entries()) {
      const run = await runTurn(agent.url, mode, chatId, message);
      const context = await readContext(agent.url, mode, chatId);
      runs.push({
        ...run,
        contextCharacters: JSON.stringify(context).length,
        cache: {
          main: cacheUsage(
            run.modelCalls.filter((call) => call.source === "agent"),
          ),
          auxiliary: cacheUsage(
            run.modelCalls.filter((call) => call.source === "context"),
          ),
        },
      });
      await save();
      const failed = run.modelCalls.filter(
        (call) => call.status !== "completed",
      );
      if (failed.length)
        throw new Error(
          `Model calls failed: ${JSON.stringify(failed)}. Inspect .gea/traces for the provider error.`,
        );
      console.log(
        `${mode} ${index + 1}/${turns.length}: ${run.modelCalls.map((call) => `${call.label ?? call.source}=${call.usage?.inputTokens ?? "?"}`).join(" ")} input tokens`,
      );
    }
    report.modes[mode].contextBeforeRestart = await readContext(
      agent.url,
      mode,
      chatId,
    );
    // Restart before this mode's first recall query; avoid cache-TTL bias from
    // waiting for all other strategies to complete before probing the first one.
    await agent.stop();
    agent = await startAgent({ quiet: true, port: 0 });
    const result = report.modes[mode];
    const restored = await readContext(agent.url, mode, result.chatId);
    result.restoredExactly =
      hash(restored) === hash(result.contextBeforeRestart);
    result.recall = await runTurn(agent.url, mode, result.chatId, question);
    result.score = scoreRecord(result.recall.text);
    result.contextAfterRecall = await readContext(
      agent.url,
      mode,
      result.chatId,
    );
    const fresh = await runTurn(
      agent.url,
      mode,
      `${id}-${mode}-fresh`,
      "What project and owner did I tell you? Return only JSON with project and owner; use null for anything I have not supplied.",
    );
    result.chatIsolation = scoreRecord(fresh.text, {
      project: null,
      owner: null,
    });
    const calls = [...result.runs, result.recall].flatMap(
      (run) => run.modelCalls,
    );
    if (calls.some((call) => call.status !== "completed"))
      throw new Error("A model call failed; partial report retained.");
    if (new Set(calls.map((call) => call.callId)).size !== calls.length)
      throw new Error("Duplicate model call id.");
    result.cache = {
      main: cacheUsage(calls.filter((call) => call.source === "agent")),
      auxiliary: cacheUsage(calls.filter((call) => call.source === "context")),
    };
    result.usageComplete = calls.every(
      (call) =>
        call.usage?.inputTokens != null && call.usage?.outputTokens != null,
    );
    if (!result.usageComplete)
      throw new Error(
        "Provider usage is incomplete; token comparisons are unavailable.",
      );
    result.mainInputTokens = calls
      .filter((call) => call.source === "agent")
      .reduce((sum, call) => sum + (call.usage?.inputTokens ?? 0), 0);
    result.auxiliaryInputTokens = calls
      .filter((call) => call.source === "context")
      .reduce((sum, call) => sum + (call.usage?.inputTokens ?? 0), 0);
    result.totalInputTokens =
      result.mainInputTokens + result.auxiliaryInputTokens;
    result.totalOutputTokens = calls.reduce(
      (sum, call) => sum + (call.usage?.outputTokens ?? 0),
      0,
    );
    result.finalMainInputTokens =
      result.recall.modelCalls.findLast((call) => call.source === "agent").usage
        ?.inputTokens ?? null;
    result.auxiliaryCalls = calls
      .filter((call) => call.source === "context")
      .map((call) => ({
        model: call.model,
        label: call.label,
        status: call.status,
      }));
    result.elapsedMs = [...result.runs, result.recall].reduce(
      (sum, run) => sum + run.elapsedMs,
      0,
    );
    await save();
  }
  const raw = report.modes.raw;
  const observations = report.modes["observational-memory"];
  report.inputReduction =
    observations.usageComplete && raw.usageComplete
      ? 1 - observations.finalMainInputTokens / raw.finalMainInputTokens
      : null;
  report.acceptance = {
    recall: observations.score.correct === observations.score.total,
    smallerContext:
      report.inputReduction != null && report.inputReduction >= 0.4,
    restart: observations.restoredExactly,
    isolation:
      observations.chatIsolation.correct === observations.chatIsolation.total,
    observationExecuted: observations.auxiliaryCalls.some(
      (call) => call.label === "observe",
    ),
    reflectionExecuted: observations.auxiliaryCalls.some(
      (call) => call.label === "reflect",
    ),
    completeUsage: observations.usageComplete,
  };
  report.passed = Object.values(report.acceptance).every(Boolean);
  await save();
  const rows = modes.map((mode) => {
    const r = report.modes[mode];
    return `| ${mode} | ${r.score.correct}/${r.score.total} | ${r.finalMainInputTokens} | ${r.mainInputTokens} | ${r.auxiliaryInputTokens} | ${r.totalInputTokens} | ${r.totalOutputTokens} | ${(r.elapsedMs / 1000).toFixed(1)} |`;
  });
  const cacheRows = modes.flatMap((mode) =>
    ["main", "auxiliary"].map((source) => {
      const c = report.modes[mode].cache[source];
      return `| ${mode} / ${source} | ${c.cacheReadTokens ?? "unreported"} | ${c.cacheWriteTokens ?? "unreported"} | ${c.noCacheTokens ?? "unreported"} | ${c.cacheReadShare == null ? "unreported" : (c.cacheReadShare * 100).toFixed(1) + "%"} |`;
    }),
  );
  const markdown = `# Observational memory verification\n\nRun: ${id}\n\nModels: main=${report.models.main}; memory=${report.models.memory}. Real API calls, local native Worker Runtime and durable DO storage.\n\n| Strategy | Recall | Final main input | All main input | Auxiliary input | Total input | Total output | Seconds |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${rows.join("\n")}\n\nFinal main input reduction: ${(report.inputReduction * 100).toFixed(1)}%. All input columns are provider-reported tokens, not estimates. Total usage includes observation/reflection/summary calls; isolation probes are excluded equally. No USD comparison: provider pricing is not configured.\n\nMain and auxiliary caching (all training and recall calls):\n\n| Strategy | Cache read | Cache write | Uncached | Read share of input |\n| --- | --- | --- | --- | --- |\n${cacheRows.join("\n")}\n\nPer-call main and auxiliary cache details are in report.json. Missing counters stay unreported. The native Anthropic model middleware adds explicit cache markers. Each strategy restarts and recalls immediately after its training turns, reducing cache-TTL bias. Provider cache sharing across identical prefixes may still affect comparisons; repeat in rotated order before generalizing.\n\nAcceptance: ${JSON.stringify(report.acceptance)}.\n\nThe default-summary control uses a lowered 8,000-token trigger for this short fixture; it is not the SDK's stock 64,000-token default. This is one synthetic scenario, not evidence of general recall quality.\n`;
  await writeFile(`${output}/summary.md`, markdown);
  console.log(markdown);
  console.log(`Saved ${output}/report.json`);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  report.error = error.message;
  await save();
  throw error;
} finally {
  await agent.stop();
}
