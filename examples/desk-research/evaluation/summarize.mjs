import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export function summarize(outcome) {
  const executionError = outcome.status === "error" ? outcome.error : null;
  const judges = outcome.judges ?? [];
  const coverage = judges.find((j) => j.id === "coverage") ?? null;
  const quality = judges.find((j) => j.id === "conversation") ?? null;
  const evaluationErrors = judges
    .filter((j) => j.status === "error")
    .map((j) => ({ id: j.id, error: j.error }));
  // This view describes retain-constraints only. Missing/NA/non-binary scores never imply pass.
  const coverageComplete =
    coverage?.status === "completed" && coverage.score === 1;
  const qualityPassed = quality?.status === "completed" && quality.score === 1;
  const status = executionError
    ? "execution_error"
    : evaluationErrors.length ||
        !coverage ||
        !quality ||
        coverage.status !== "completed" ||
        quality.status !== "completed" ||
        ![0, 1].includes(coverage.score) ||
        ![0, 1].includes(quality.score)
      ? "evaluation_error"
      : !coverageComplete
        ? "coverage_incomplete"
        : !qualityPassed
          ? "quality_failed"
          : "passed";
  return {
    caseId: outcome.case.id,
    status,
    coverageComplete,
    coverage,
    observedQuality: quality,
    executionError,
    evaluationErrors,
  };
}
export function checkCalibration(fixtures, outcomes) {
  return fixtures.map((f) => {
    const outcome = outcomes.find((o) => o.case.id === f.id);
    const actual = outcome?.judges?.find((j) => j.id === f.judge);
    const matched =
      outcome?.status !== "error" &&
      actual?.status === f.expected.status &&
      (f.expected.status === "error"
        ? actual.error?.code === "insufficient_evidence"
        : actual.score === f.expected.score);
    return { id: f.id, matched, expected: f.expected, actual: actual ?? null };
  });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, directory, output] = process.argv.slice(2);
  if (!["calibration", "conversation"].includes(mode) || !directory || !output)
    throw new Error(
      "Usage: node evaluation/summarize.mjs calibration|conversation <evaluation-directory> <new-summary.json>",
    );
  const manifest = JSON.parse(
    await readFile(path.join(directory, "evaluation.json"), "utf8"),
  );
  const outcomes = [];
  for (const c of manifest.cases) {
    try {
      outcomes.push(
        JSON.parse(await readFile(path.join(directory, c.result), "utf8")),
      );
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  let result;
  if (mode === "calibration") {
    const { fixtures } = JSON.parse(
      await readFile(
        new URL("fixtures/calibration.json", import.meta.url),
        "utf8",
      ),
    );
    const checks = checkCalibration(fixtures, outcomes);
    result = {
      evaluationId: manifest.evaluationId,
      status: manifest.status,
      checks,
      passed: manifest.status === "completed" && checks.every((c) => c.matched),
    };
  } else
    result = {
      evaluationId: manifest.evaluationId,
      cases: outcomes
        .filter((o) => o.case.id === "retain-constraints")
        .map(summarize),
    };
  await writeFile(output, JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  if (mode === "calibration" && !result.passed) process.exitCode = 1;
}
