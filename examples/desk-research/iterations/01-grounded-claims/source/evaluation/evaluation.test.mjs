import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  fixtureRun,
  requireNewDirectory,
  canonical,
  hash,
} from "./prepare.mjs";
import { summarize, checkCalibration } from "./summarize.mjs";
const outcome = (coverage, quality, extra = {}) => ({
  case: { id: "retain-constraints" },
  judges: [
    ...(coverage === undefined
      ? []
      : [{ id: "coverage", status: "completed", score: coverage }]),
    { id: "conversation", status: "completed", score: quality },
  ],
  ...extra,
});
test("missing coverage cannot promote observed quality to full pass", () => {
  const r = summarize(outcome(0, 1));
  assert.equal(r.status, "coverage_incomplete");
  assert.equal(r.observedQuality.score, 1);
  assert.equal(summarize(outcome(undefined, 1)).status, "evaluation_error");
});
test("coverage and answer quality are independent", () => {
  assert.equal(summarize(outcome(1, 0)).status, "quality_failed");
  assert.equal(summarize(outcome(1, 1)).status, "passed");
  assert.equal(
    summarize(
      outcome(1, 1, {
        status: "error",
        error: { code: "agent_execution_failed" },
      }),
    ).status,
    "execution_error",
  );
});
test("errors and not-applicable cannot pass or disappear", () => {
  for (const status of ["error", "not_applicable"])
    assert.equal(
      summarize(
        outcome(1, 1, {
          judges: [
            { id: "coverage", status, error: { code: "judge_failed" } },
            { id: "conversation", status: "completed", score: 1 },
          ],
        }),
      ).status,
      "evaluation_error",
    );
  assert.equal(summarize(outcome(0.5, 1)).status, "evaluation_error");
});
test("a transport error is not a calibrated insufficient-evidence decision", () => {
  const f = [{ id: "x", judge: "evidence", expected: { status: "error" } }];
  assert.equal(
    checkCalibration(f, [
      {
        case: { id: "x" },
        judges: [
          { id: "evidence", status: "error", error: { code: "judge_failed" } },
        ],
      },
    ])[0].matched,
    false,
  );
  assert.equal(checkCalibration(f, [])[0].matched, false);
});
test("fixture labels stay outside native scoring evidence and hashes bind exact evidence", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "research-calibration-"));
  try {
    const dest = await fixtureRun(path.join(root, "run"));
    const artifact = JSON.parse(
      await readFile(path.join(dest, "benchmarks/calibration.json")),
    );
    const s = artifact.snapshot;
    assert.equal(
      s.contentHash,
      hash(
        canonical({
          cases: s.cases.map(({ sourcePath, ...x }) => x),
          judges: s.judges.map(({ sourcePath, ...x }) => x),
          codeJudgeBundleHash: null,
          schemaVersion: s.schemaVersion,
        }),
      ),
    );
    assert.equal(s.cases.length, 32);
    for (const c of s.cases) {
      const e = JSON.parse(
        await readFile(path.join(dest, `executions/calibration/${c.id}.json`)),
      );
      assert.equal(c.expected, undefined);
      assert.equal(e.case.expected, undefined);
      assert.equal(e.case.metadata.expected, undefined);
      assert.equal(c.judgeKeys.length, 1);
    }
    await assert.rejects(fixtureRun(dest), /overwrite/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("materialization refuses source writes, including an aliased parent", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "research-overlay-"));
  try {
    const source = path.join(root, "source");
    await mkdir(source);
    await symlink(source, path.join(root, "alias"));
    await assert.rejects(
      requireNewDirectory(path.join(root, "alias/new"), source),
      /outside/,
    );
    await assert.rejects(requireNewDirectory(source, source), /outside/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
