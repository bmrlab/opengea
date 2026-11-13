import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

// Native Workers supply a compiled WASM module; Node otherwise tries to
// instantiate it without the worker host. Compile only, for this offline test.
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith("/agent-core.wasm")) return nextLoad(url, context);
    const bytes = readFileSync(new URL(url)).toString("base64");
    return { format: "module", shortCircuit: true,
      source: `export default new WebAssembly.Module(Buffer.from(${JSON.stringify(bytes)}, "base64"));` };
  },
});
import { createAgentEvalWorker } from "@gea-ai/agent-sdk/evals";

const rubric = await readFile(new URL("../benchmarks/judges/recommendation.judge.md", import.meta.url), "utf8");
const scenario = JSON.parse(await readFile(new URL("../benchmarks/cases/commute-weekend/case.json", import.meta.url), "utf8"));
// Frozen real dialogue from the historical source runner. Scores below are MOCK
// submissions: these tests exercise the public worker, not model quality.
const history = JSON.parse(await readFile(new URL("./fixtures/recommendation-history.json", import.meta.url), "utf8"));
const dimensions = ["conversation", "clarification", "progressiveDisclosure", "initialRecommendation", "adjustment", "finalFit"];
const worker = createAgentEvalWorker({ codeJudges: {}, markdownJudges: { recommendation: rubric } });

function toolStream(calls) {
  const chunks = [
    { choices: [{ index: 0, delta: { role: "assistant", tool_calls: calls.map(([name, args], index) => ({
      index, id: `call-${index}`, type: "function", function: { name, arguments: JSON.stringify(args) },
    })) }, finish_reason: null }] },
    { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] },
  ];
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream" },
  });
}

async function replay({ messages = structuredClone(history.messages), failed, invalidScore, insufficient = false } = {}) {
  // Historical text-only fixture omits runtime IDs; supply stable test IDs.
  messages = messages.map((message, index) => ({ ...message, id: `history-${index}` }));
  let step = 0;
  let submission;
  const checks = Object.fromEntries(dimensions.map((key) => [key, {
    score: key === failed ? 0 : 1,
    reason: key === failed ? "Mock：场景明确违反此项" : "Mock：此项通过",
    messageIds: [messages.at(-1).id],
  }]));
  const response = await worker.fetch(new Request("https://judge.invalid/v1/evaluate", {
    method: "POST",
    body: JSON.stringify({
      judge: { id: "recommendation", key: "recommendation", kind: "markdown", model: "offline-mock", maxSteps: 4 },
      context: { caseId: "commute-weekend", input: scenario.input, messages, runId: "offline-replay" },
    }),
  }), { AI: {
    // The SDK's AI host binding is fully mocked; no process env or network.
    async fetch(path, init) {
      if (!init?.body) return Response.json({ providerType: "openai-compatible", format: "openai-completions", cacheControl: "off" });
      const request = JSON.parse(init.body);
      if (step++ === 0) {
        assert.ok(request.messages.some((message) => typeof message.content === "string" && message.content.includes(rubric)));
        const submit = request.tools.find((tool) => tool.function.name === "submitEvaluation");
        assert.ok(submit.function.parameters.properties.score);
        return toolStream([["queryRun", { kind: "messages", limit: 20 }]]);
      }
      const toolResults = request.messages.filter((message) => message.role === "tool");
      if (step === 2) {
        const page = JSON.parse(toolResults.at(-1).content);
        assert.equal(page.nextCursor, null, JSON.stringify(page));
        assert.equal(page.items.length, messages.length);
        return toolStream(page.items.map((item) => ["readEvidence", {
          source: "message", messageId: item.messageId, partIndex: item.partIndex,
        }]));
      }
      assert.equal(step, 3);
      const reads = toolResults.slice(-messages.length).map((message) => JSON.parse(message.content));
      for (const [index, read] of reads.entries()) {
        assert.equal(read.messageId, messages[index].id);
        assert.equal(read.nextOffset, null);
        assert.deepEqual(JSON.parse(read.text), messages[index].parts[0]);
      }
      submission = insufficient ? {
        status: "error", reason: "Mock：无法读取必要证据", error: { code: "insufficient_evidence", message: "Mock evidence unavailable" },
      } : {
        status: "completed", score: invalidScore ?? (failed ? 5 / 6 : 1),
        reason: JSON.stringify({ checks, summary: "离线 mock 判分，不是实时 LLM 评价" }),
        evidence: reads.map((read) => read.evidenceReference),
      };
      return toolStream([["submitEvaluation", submission]]);
    },
  } });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(step, 3, `worker must query and read the history before submission: ${JSON.stringify(result)}`);
  return { result, submission };
}

test("Markdown entry, six-dimension rubric and existing gate contract", async () => {
  assert.deepEqual(await readdir(new URL("../benchmarks/judges/", import.meta.url)), ["recommendation.judge.md"]);
  for (const dimension of dimensions) assert.ok(rubric.includes(`**${dimension}**`));
  for (const term of ["queryRun", "readEvidence", "submitEvaluation", "insufficient_evidence", "messageIds", "score", "358", "429"]) assert.ok(rubric.includes(term));
  assert.equal(scenario.judgeRules.recommendation.minScore, 1);
  assert.equal(history.messages.length, 14);
});

test("historical positive replay through SDK Markdown worker with mock score", async () => {
  const { result, submission } = await replay();
  assert.equal(result.kind, "markdown");
  assert.equal(result.status, "completed");
  assert.equal(result.score, 1);
  assert.equal(result.reason, submission.reason);
  assert.deepEqual(result.evidence, submission.evidence);
});

for (const [name, failed, index, replacement] of [
  ["wrong final price", "finalFit", 13, "最终蓝色轻旅24，含雨罩总价999元。"],
  ["refuses capacity adjustment", "adjustment", 9, "虽然你需要至少24L，仍选22L城行22，不调整。"],
]) {
  test(`${name}: mock failure stays below the Case gate`, async () => {
    const messages = structuredClone(history.messages);
    messages[index].parts[0].text = replacement;
    const { result } = await replay({ messages, failed });
    assert.equal(result.status, "completed");
    assert.equal(result.score, 5 / 6);
    assert.ok(result.score < scenario.judgeRules.recommendation.minScore);
    assert.equal(JSON.parse(result.reason).checks[failed].score, 0);
  });
}

test("out-of-range LLM submission is rejected by SDK schema", async () => {
  const { result } = await replay({ invalidScore: 2 });
  assert.equal(result.status, "error");
  assert.equal(result.score, undefined);
});

test("insufficient evidence remains an error, never a passing score", async () => {
  const { result } = await replay({ insufficient: true });
  assert.equal(result.status, "error");
  assert.equal(result.error.code, "insufficient_evidence");
  assert.equal(result.score, undefined);
});
