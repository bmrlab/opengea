import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const stage of ["v1-research", "v2-workbench", "v3-feishu"]) {
  test(`materialized ${stage} type-checks with the locked dependencies`, async () => {
    const temp = await mkdtemp(path.join(tmpdir(), "desk-research-materialize-"));
    const target = path.join(temp, stage);
    try {
      execFileSync(process.execPath, ["scripts/materialize.mjs", stage, target], { cwd: root });
      await symlink(path.join(root, "node_modules"), path.join(target, "node_modules"), "dir");
      assert.equal(execFileSync(process.execPath, [path.join(root, "node_modules/typescript/bin/tsc"), "--noEmit"], { cwd: target, encoding: "utf8" }), "");
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
}
