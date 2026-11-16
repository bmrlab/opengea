import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
test("a newly created snapshot includes the dependencies needed to materialize a stage", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "research-snapshot-"));
  try {
    const project = path.join(temp, "project");
    await cp(root, project, {
      recursive: true,
      filter: (entry) =>
        !["node_modules", ".gea", "iterations", ".env"].includes(
          path.basename(entry),
        ) && !path.basename(entry).startsWith(".env."),
    });
    await mkdir(path.join(project, "iterations"));
    for (const file of ["analyze-eval.mjs", "analyze-eval.test.mjs"])
      await cp(
        path.join(root, "iterations", file),
        path.join(project, "iterations", file),
      );
    const bin = path.join(temp, "bin");
    await mkdir(bin);
    // Snapshot metadata asks only for the CLI version; no CLI runtime is tested here.
    await writeFile(
      path.join(bin, "gea"),
      '#!/bin/sh\nprintf "snapshot-test-cli\\n"\n',
      { mode: 0o755 },
    );
    execFileSync(
      process.execPath,
      [
        path.join(project, "scripts/snapshot-iteration.mjs"),
        "create",
        "99-test",
      ],
      {
        cwd: project,
        env: {
          ...process.env,
          PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        },
        stdio: "pipe",
      },
    );
    const source = path.join(project, "iterations/99-test/source");
    const target = path.join(temp, "stage");
    execFileSync(
      process.execPath,
      [path.join(source, "scripts/materialize.mjs"), "v1-research", target],
      { stdio: "pipe" },
    );
    for (const file of [
      "evaluation/summarize.mjs",
      "evaluation/evaluation.test.mjs",
      "iterations/analyze-eval.mjs",
      "iterations/analyze-eval.test.mjs",
    ])
      assert.equal(
        await readFile(path.join(target, file), "utf8"),
        await readFile(path.join(root, file), "utf8"),
      );
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
