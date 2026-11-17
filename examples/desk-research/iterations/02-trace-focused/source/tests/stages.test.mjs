import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const script = path.join(root, "scripts/materialize.mjs");

test("stage projects preserve the benchmark and expose only their intended capabilities", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "research-stages-"));
  try {
    for (const stage of ["v1-research", "v2-workbench", "v3-feishu"]) {
      const target = path.join(temp, stage);
      execFileSync(process.execPath, [script, stage, target]);
      const config = JSON.parse(
        await readFile(path.join(target, "gea.worker.json")),
      );
      const agent = await readFile(path.join(target, "agent.ts"), "utf8");
      const entries = await readdir(target);
      assert.equal(entries.includes("app"), stage !== "v1-research");
      assert.equal(
        Boolean(config.durableObjectBindings?.length),
        stage !== "v1-research",
      );
      assert.equal(agent.includes("extension: feishu"), stage === "v3-feishu");
      for (const excluded of [
        ".gea",
        ".env",
        "node_modules",
        "dist",
        "versions",
      ])
        assert.equal(entries.includes(excluded), false);
      const casePath =
        "benchmarks/single-turn/cases/willingness-to-pay/case.json";
      assert.equal(
        await readFile(path.join(target, casePath), "utf8"),
        await readFile(path.join(root, casePath), "utf8"),
      );
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("materialization refuses existing projects and unknown stages without changing files", async () => {
  const temp = await mkdtemp(path.join(tmpdir(), "research-existing-"));
  try {
    const sentinel = path.join(temp, "keep.txt");
    await writeFile(sentinel, "user work");
    assert.throws(() =>
      execFileSync(process.execPath, [script, "v1-research", temp], {
        stdio: "pipe",
      }),
    );
    assert.equal(await readFile(sentinel, "utf8"), "user work");
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [script, "unknown", path.join(temp, "new")],
        { stdio: "pipe" },
      ),
    );
    assert.deepEqual(await readdir(temp), ["keep.txt"]);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
