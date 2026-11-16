import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [directory, destination, evaluationDirectory] = process.argv.slice(2);
if (!directory || !destination)
  throw new Error(
    "Usage: node iterations/analyze-eval.mjs <result-directory> <new-report.json> [evaluation-directory]",
  );
const root = path.resolve(directory);
const meta = JSON.parse(await readFile(path.join(root, "run.json"), "utf8"));
const evaluationRoot = evaluationDirectory
  ? path.resolve(evaluationDirectory)
  : null;
const evaluation = evaluationRoot
  ? JSON.parse(
      await readFile(path.join(evaluationRoot, "evaluation.json"), "utf8"),
    )
  : null;
if (evaluation && evaluation.runId !== meta.runId)
  throw new Error("Evaluation belongs to a different Run");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const optional = async (file) => {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return null;
  }
};
const cleanUrl = (value) => {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
};
const sourceInfo = (source) => ({
  url: cleanUrl(source.url),
  title: source.title,
  publishedAt: source.publishedAt,
  textLength: source.textLength ?? source.text?.length ?? 0,
  textScope: source.textScope,
  truncated: source.truncated,
});
const publicConversation = (conversation) =>
  conversation
    ? {
        schemaVersion: conversation.schemaVersion,
        baselineEligible: conversation.baselineEligible,
        intervened: conversation.intervened,
        stopReason: conversation.stopReason,
        turns: (conversation.turns ?? []).map((turn) => ({
          turn: turn.turn,
          input: turn.input,
          inputMessageId: turn.inputMessageId,
          inputSource: turn.inputSource,
          target: turn.target
            ? {
                runId: turn.target.runId,
                status: turn.target.status,
                messageIds: turn.target.messageIds,
              }
            : undefined,
          simulator: turn.simulator
            ? { runId: turn.simulator.runId, status: turn.simulator.status }
            : undefined,
        })),
      }
    : undefined;
const canonicalCitation = (value) => {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
};
const citationAudit = (output, messages) => {
  const captured = new Set();
  const calls = {};
  for (const message of messages ?? [])
    for (const part of message.parts ?? []) {
      if (!part.type?.startsWith("tool-")) continue;
      const name = part.type.slice(5);
      calls[name] = (calls[name] ?? 0) + 1;
      if (!["search_sources", "read_source"].includes(name)) continue;
      for (const source of [
        ...(part.output?.sources ?? []),
        ...(part.output?.source ? [part.output.source] : []),
      ]) {
        const url = canonicalCitation(source.url);
        if (url) captured.add(url);
      }
    }
  const text = String(output ?? "");
  const markdown = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/gu)].map(
    (match) => match[1],
  );
  const plain = [
    ...text.matchAll(
      /https?:\/\/[^\s<>"'()[\]，。；！？、：（）【】《》“”‘’]+/gu,
    ),
  ].map((match) => match[0].replace(/[.,;!]+$/u, ""));
  const citations = [...new Set([...markdown, ...plain])];
  return {
    method:
      "Compare Markdown and plain HTTP(S) citation URLs in run.output with URLs actually returned by search_sources/read_source. Ignore fragments only. This checks source identity, not whether a claim is supported.",
    toolCalls: calls,
    outputCharacters: String(output ?? "").length,
    capturedSourceCount: captured.size,
    citationCount: citations.length,
    unmatched: citations
      .filter((url) => !captured.has(canonicalCitation(url)))
      .map(cleanUrl),
    invalid: citations.filter((url) => canonicalCitation(url) === null),
  };
};
const cases = [];
for (const agent of meta.agents) {
  const selectedCases = evaluation
    ? agent.cases.filter((c) =>
        evaluation.cases.some(
          (e) => e.agentKey === agent.key && e.caseId === c.id,
        ),
      )
    : agent.cases;
  if (!selectedCases.length) continue;
  const benchmark = JSON.parse(
    await readFile(
      path.join(evaluationRoot ?? root, agent.benchmarkArtifact),
      "utf8",
    ),
  );
  for (const testCase of selectedCases) {
    const evaluationCase = evaluation?.cases.find(
      (e) => e.agentKey === agent.key && e.caseId === testCase.id,
    );
    const scored = await optional(
      evaluationCase
        ? path.join(evaluationRoot, evaluationCase.result)
        : path.join(root, "cases", agent.key, `${testCase.id}.json`),
    );
    const execution = await optional(
      path.join(root, "executions", agent.key, `${testCase.id}.json`),
    );
    // An unfinished selected evaluation must never inherit a prior passing grade.
    const raw = evaluation ? scored : (scored ?? execution);
    if (!raw) {
      cases.push({ id: testCase.id, status: "missing" });
      continue;
    }
    const artifact = JSON.parse(raw),
      run = artifact.run ?? {};
    const judges = (artifact.judges ?? []).map(
      ({ id, kind, status, score, hardFail, reason, error }) => ({
        id,
        kind,
        status,
        score,
        hardFail,
        reason,
        error,
      }),
    );
    const rules = artifact.case?.judgeRules ?? {};
    const failed = judges.some(
      (j) =>
        j.status === "completed" &&
        (j.hardFail === true ||
          (typeof j.score === "number" &&
            j.score < (rules[j.id]?.minScore ?? 0))),
    );
    const required = Object.entries(rules).filter(
      ([, rule]) => rule.required !== false,
    );
    const incomplete = required.some(
      ([id]) =>
        !judges.some(
          (j) =>
            j.id === id &&
            j.status === "completed" &&
            typeof j.score === "number",
        ),
    );
    const trajectory = [];
    for (const message of run.messages ?? []) {
      for (const part of message.parts ?? []) {
        if (part.type === "text") {
          trajectory.push({
            messageId: message.id,
            role: message.role,
            type: "text",
            text: part.text,
          });
        } else if (part.type?.startsWith("tool-")) {
          const name = part.type.slice(5),
            output = part.output;
          trajectory.push({
            messageId: message.id,
            role: message.role,
            type: "tool",
            name,
            state: part.state,
            input:
              name === "search_sources"
                ? { query: part.input?.query }
                : name === "read_source"
                  ? { url: cleanUrl(part.input?.url) }
                  : undefined,
            error: part.errorText,
            sources: output?.sources?.map(sourceInfo),
            source: output?.source ? sourceInfo(output.source) : undefined,
            retrievedAt: output?.retrievedAt,
          });
        }
      }
    }
    cases.push({
      id: testCase.id,
      agentKey: agent.key,
      status: artifact.error
        ? "execution_error"
        : failed
          ? "failed"
          : incomplete || judges.some((j) => j.status === "error")
            ? "incomplete"
            : judges.length
              ? "passed"
              : "unscored",
      error: artifact.error,
      runId: run.runId,
      benchmarkHash: benchmark.snapshot.contentHash,
      input: artifact.case?.input,
      acceptance: artifact.case?.metadata?.acceptance,
      judges,
      judging: {
        required: required.length,
        completedRequired: required.filter(([id]) =>
          judges.some(
            (j) =>
              j.id === id &&
              j.status === "completed" &&
              typeof j.score === "number",
          ),
        ).length,
        errors: judges.filter((j) => j.status === "error").length,
      },
      output: run.output,
      conversation: publicConversation(
        artifact.conversation ?? run.conversation,
      ),
      trajectory,
      citationAudit: citationAudit(run.output, run.messages),
      rawArtifactSha256: hash(raw),
    });
  }
}
const report = {
  schemaVersion: "opengea.iteration-report.v1",
  runId: meta.runId,
  status: meta.status,
  startedAt: meta.startedAt,
  completedAt: meta.completedAt,
  judgeModel: meta.judgeModel,
  runtime: meta.runtime,
  evaluation: evaluation
    ? {
        evaluationId: evaluation.evaluationId,
        status: evaluation.status,
        judgeSource: evaluation.judgeSource,
        judgeModel: evaluation.judgeModel,
        judgeRuntimeHash: evaluation.judgeRuntimeHash,
        maxSteps: evaluation.maxSteps,
        timeoutMs: evaluation.timeoutMs,
        startedAt: evaluation.startedAt,
        completedAt: evaluation.completedAt,
      }
    : undefined,
  targets: meta.agents.map((a) => ({
    key: a.key,
    agentSnapshotHash: a.agentSnapshotHash,
    applicationContentHash: a.applicationContentHash,
    selectedCaseIds: a.selectedCaseIds,
  })),
  counts: Object.fromEntries(
    [
      "passed",
      "failed",
      "incomplete",
      "execution_error",
      "unscored",
      "missing",
    ].map((s) => [s, cases.filter((c) => c.status === s).length]),
  ),
  judging: {
    required: cases.reduce((n, c) => n + (c.judging?.required ?? 0), 0),
    completedRequired: cases.reduce(
      (n, c) => n + (c.judging?.completedRequired ?? 0),
      0,
    ),
    errors: cases.reduce((n, c) => n + (c.judging?.errors ?? 0), 0),
  },
  sharing:
    "Tool payloads are reduced to queries and source metadata; raw evidence stays local. Review generated answer/Judge text before sharing.",
  cases,
};
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(report, null, 2) + "\n", {
  flag: "wx",
});
console.log(
  JSON.stringify({
    runId: report.runId,
    status: report.status,
    counts: report.counts,
  }),
);
