import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("reports incomplete grading separately and checks actual citation identity", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iteration-analysis-"));
  try {
    await mkdir(path.join(root, "cases", "research"), { recursive: true });
    const ids = ["good", "bad", "missing-score"];
    await writeFile(
      path.join(root, "run.json"),
      JSON.stringify({
        runId: "fixture",
        status: "completed",
        agents: [
          {
            key: "research",
            benchmarkArtifact: "benchmark.json",
            cases: ids.map((id) => ({ id })),
          },
        ],
      }),
    );
    await writeFile(
      path.join(root, "benchmark.json"),
      JSON.stringify({ snapshot: { contentHash: "fixture" } }),
    );
    for (const id of ids)
      await writeFile(
        path.join(root, "cases", "research", id + ".json"),
        JSON.stringify({
          case: {
            judgeRules: {
              evidence: { minScore: 1, required: true },
              scope: { minScore: 1, required: true },
            },
          },
          judges: [
            {
              id: "evidence",
              status: "completed",
              ...(id === "missing-score"
                ? {}
                : { score: id === "bad" ? 0 : 1 }),
            },
            {
              id: "scope",
              status: id === "bad" ? "error" : "completed",
              ...(id === "bad" ? {} : { score: 1 }),
            },
          ],
          run: {
            output:
              "[source](https://example.com/article#section) [wrong](https://example.com/) [broken](https://) https://example.com/article#other （https://example.com/article）正文",
            messages: [
              {
                role: "assistant",
                parts: [
                  {
                    type: "tool-search_sources",
                    output: {
                      sources: [
                        { url: "https://example.com/article", text: "fixture" },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        }),
      );
    const dest = path.join(root, "report.json"),
      script = fileURLToPath(new URL("./analyze-eval.mjs", import.meta.url));
    execFileSync(process.execPath, [script, root, dest]);
    const report = JSON.parse(await readFile(dest, "utf8"));
    assert.equal(report.counts.passed, 1);
    assert.equal(report.counts.failed, 1);
    assert.equal(report.counts.incomplete, 1);
    assert.deepEqual(report.judging, {
      required: 6,
      completedRequired: 4,
      errors: 1,
    });
    assert.deepEqual(report.cases[0].citationAudit.unmatched, [
      "https://example.com/",
      null,
    ]);
    assert.deepEqual(report.cases[0].citationAudit.invalid, ["https://"]);
    assert.equal(report.cases[0].citationAudit.toolCalls.search_sources, 1);
    assert.throws(
      () =>
        execFileSync(process.execPath, [script, root, dest], { stdio: "pipe" }),
      /EEXIST/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("exports the selected rescoring without falling back to earlier grades", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "iteration-rescore-"));
  try {
    const evaluation = path.join(root, "evaluation");
    await mkdir(path.join(evaluation, "cases"), { recursive: true });
    await mkdir(path.join(evaluation, "benchmarks"));
    await writeFile(
      path.join(root, "run.json"),
      JSON.stringify({
        runId: "run",
        status: "completed",
        agents: [
          {
            key: "research",
            benchmarkArtifact: "benchmarks/research.json",
            cases: [{ id: "a" }, { id: "b" }],
          },
        ],
      }),
    );
    const manifest = {
      runId: "run",
      evaluationId: "new-grade",
      status: "completed",
      judgeSource: "workspace",
      cases: [{ agentKey: "research", caseId: "a", result: "cases/0.json" }],
    };
    await writeFile(
      path.join(evaluation, "evaluation.json"),
      JSON.stringify(manifest),
    );
    await writeFile(
      path.join(evaluation, "benchmarks/research.json"),
      JSON.stringify({ snapshot: { contentHash: "new-rubric" } }),
    );
    await writeFile(
      path.join(evaluation, "cases/0.json"),
      JSON.stringify({
        case: { judgeRules: { evidence: { required: true, minScore: 1 } } },
        judges: [{ id: "evidence", status: "completed", score: 0 }],
        run: { output: "Wrong citation" },
      }),
    );
    const script = fileURLToPath(
      new URL("./analyze-eval.mjs", import.meta.url),
    );
    const dest = path.join(root, "report.json");
    execFileSync(process.execPath, [script, root, dest, evaluation], {
      stdio: "pipe",
    });
    const report = JSON.parse(await readFile(dest, "utf8"));
    assert.equal(report.evaluation.evaluationId, "new-grade");
    assert.equal(report.cases.length, 1);
    assert.equal(report.cases[0].status, "failed");
    assert.equal(report.cases[0].benchmarkHash, "new-rubric");
    await rm(path.join(evaluation, "cases/0.json"));
    execFileSync(
      process.execPath,
      [script, root, path.join(root, "missing.json"), evaluation],
      { stdio: "pipe" },
    );
    assert.equal(
      JSON.parse(await readFile(path.join(root, "missing.json"), "utf8"))
        .cases[0].status,
      "missing",
    );
    await writeFile(
      path.join(evaluation, "evaluation.json"),
      JSON.stringify({ ...manifest, runId: "different" }),
    );
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [script, root, path.join(root, "bad.json"), evaluation],
          { stdio: "pipe" },
        ),
      /different Run/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
