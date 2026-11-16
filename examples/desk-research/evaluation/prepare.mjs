import {
  cp,
  mkdir,
  readFile,
  writeFile,
  access,
  realpath,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
const here = path.dirname(fileURLToPath(import.meta.url));
export const hash = (s) =>
  `sha256:${createHash("sha256").update(s).digest("hex")}`;
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object")
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
      .join(",")}}`;
  return JSON.stringify(v);
}
const json = (p, v) =>
  writeFile(p, JSON.stringify(v, null, 2) + "\n", { flag: "wx" });
export async function requireNewDirectory(destination, source) {
  const dest = path.join(
    await realpath(path.dirname(path.resolve(destination))),
    path.basename(destination),
  );
  if (source) source = await realpath(source);
  if (
    source &&
    (dest === path.resolve(source) ||
      dest.startsWith(path.resolve(source) + path.sep))
  )
    throw new Error("Destination must be outside the source tree");
  try {
    await access(dest);
  } catch (e) {
    if (e.code === "ENOENT") {
      await mkdir(dest, { recursive: true });
      return dest;
    }
    throw e;
  }
  throw new Error("Destination exists; refusing to overwrite");
}
export async function fixtureRun(destination) {
  const dest = await requireNewDirectory(destination);
  const { fixtures } = JSON.parse(
    await readFile(path.join(here, "fixtures/calibration.json"), "utf8"),
  );
  const judges = await Promise.all(
    ["scope", "evidence", "coverage", "conversation"].map(async (id) => ({
      id,
      key: `judges/${id}.judge.md`,
      kind: "markdown",
      rubric: await readFile(path.join(here, `judges/${id}.judge.md`), "utf8"),
      sourcePath: `benchmarks/calibration/judges/${id}.judge.md`,
    })),
  );
  const cases = fixtures.map((f) => ({
    id: f.id,
    input: { message: f.input },
    metadata: { acceptance: f.acceptance },
    judgeRules: { [f.judge]: { required: true, minScore: 1 } },
    judgeKeys: [`judges/${f.judge}.judge.md`],
    sourcePath: `benchmarks/calibration/cases/${f.id}/case.json`,
  }));
  const semantic = {
    cases: cases.map(({ sourcePath, ...c }) => c),
    judges: judges.map(({ sourcePath, ...j }) => j),
    codeJudgeBundleHash: null,
    schemaVersion: "gea.benchmark_snapshot.v1",
  };
  const snapshot = {
    ...semantic,
    cases,
    judges,
    contentHash: hash(canonical(semantic)),
    benchmark: { key: "calibration", title: "Synthetic Judge calibration" },
    source: { kind: "filesystem", path: "benchmarks/calibration" },
  };
  const artifact = {
    schemaVersion: "gea.benchmark_artifact.v1",
    codeJudgeBundle: null,
    snapshot,
    sources: judges.map((j) => ({
      path: j.sourcePath,
      content: j.rubric,
      sha256: hash(j.rubric),
    })),
  };
  await mkdir(path.join(dest, "benchmarks"));
  await json(path.join(dest, "benchmarks/calibration.json"), artifact);
  await mkdir(path.join(dest, "executions/calibration"), { recursive: true });
  for (const [index, f] of fixtures.entries()) {
    const messages = f.messages.map((m, i) => ({
      id: `${f.id}-${i}`,
      role: m.role,
      parts: [
        ...(m.sources?.length
          ? [
              {
                type: "tool-search_sources",
                toolCallId: `${f.id}-search-${i}`,
                state: "output-available",
                input: { query: f.input },
                output: { sources: m.sources },
              },
            ]
          : []),
        { type: "text", text: m.text },
      ],
    }));
    const { judgeKeys, sourcePath, ...c } = cases[index];
    await json(path.join(dest, `executions/calibration/${f.id}.json`), {
      agentKey: "calibration",
      case: { ...c, path: sourcePath },
      judges: [],
      run: {
        chatId: `fixture-${f.id}`,
        runId: `fixture-${f.id}`,
        messages,
        output:
          [...f.messages].reverse().find((m) => m.role === "assistant")?.text ??
          "",
      },
    });
  }
  const now = new Date().toISOString();
  await json(path.join(dest, "run.json"), {
    schemaVersion: "gea.eval_local_run.v1",
    runId: randomUUID(),
    status: "completed",
    startedAt: now,
    completedAt: now,
    judgeModel: "creative-reasoning-1.5",
    runtime: {
      defaultComputerBackend: "virtual",
      location: "local",
      nodeVersion: process.version,
      os: process.platform,
    },
    agents: [
      {
        agentSnapshotHash: hash(
          canonical(fixtures.map(({ expected, ...f }) => f)),
        ),
        applicationContentHash: hash(
          await readFile(fileURLToPath(import.meta.url)),
        ),
        key: "calibration",
        benchmark: "benchmarks/calibration",
        benchmarkArtifact: "benchmarks/calibration.json",
        selectedCaseIds: cases.map((c) => c.id),
        cases: cases.map((c) => ({
          id: c.id,
          result: `executions/calibration/${c.id}.json`,
        })),
      },
    ],
  });
  await json(
    path.join(dest, "expected.json"),
    Object.fromEntries(fixtures.map((f) => [f.id, f.expected])),
  );
  await json(path.join(dest, "provenance.json"), {
    kind: "synthetic-calibration-fixtures",
    agentExecuted: false,
    fixtureHash: hash(
      await readFile(path.join(here, "fixtures/calibration.json")),
    ),
    rubrics: Object.fromEntries(judges.map((j) => [j.id, hash(j.rubric)])),
  });
  return dest;
}
export async function overlay(source, destination, mode = "rescore") {
  if (!["rescore", "scenario"].includes(mode))
    throw new Error("Expected rescore or scenario");
  const dest = await requireNewDirectory(destination, source);
  await cp(source, dest, {
    recursive: true,
    filter: (p) =>
      !["node_modules", ".gea", ".git"].includes(path.basename(p)) &&
      !path.basename(p).startsWith(".env"),
  });
  for (const [kind, ids] of [
    ["single-turn", ["scope", "evidence"]],
    ["multi-turn", ["coverage", "conversation"]],
  ]) {
    for (const id of ids)
      await cp(
        path.join(here, `judges/${id}.judge.md`),
        path.join(dest, `benchmarks/${kind}/judges/${id}.judge.md`),
      );
  }
  // Rescoring must preserve the original Simulator/input; only future executions use the revised goal.
  const target = path.join(
    dest,
    "benchmarks/multi-turn/cases/retain-constraints/case.json",
  );
  const c = JSON.parse(
    await readFile(
      mode === "scenario"
        ? path.join(here, "retain-constraints.case.json")
        : target,
      "utf8",
    ),
  );
  c.judgeRules = { ...c.judgeRules, coverage: { required: true, minScore: 1 } };
  await writeFile(target, JSON.stringify(c, null, 2) + "\n");
  for (const name of await readdir(
    path.join(dest, "benchmarks/multi-turn/cases"),
  )) {
    const file = path.join(
      dest,
      "benchmarks/multi-turn/cases",
      name,
      "case.json",
    );
    const item = JSON.parse(await readFile(file, "utf8"));
    const current = JSON.parse(
      await readFile(
        path.join(here, "../benchmarks/multi-turn/cases", name, "case.json"),
        "utf8",
      ),
    );
    item.metadata = { ...item.metadata, coverage: current.metadata.coverage };
    item.judgeRules = {
      ...item.judgeRules,
      coverage: { required: true, minScore: 1 },
    };
    await writeFile(file, JSON.stringify(item, null, 2) + "\n");
  }
  return dest;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, a, b, c] = process.argv.slice(2);
  if (mode === "fixtures" && a) console.log(await fixtureRun(a));
  else if (mode === "overlay" && a && b) console.log(await overlay(a, b, c));
  else
    throw new Error(
      "Usage: node evaluation/prepare.mjs fixtures <new-dir> | overlay <source> <new-dir> [rescore|scenario]",
    );
}
