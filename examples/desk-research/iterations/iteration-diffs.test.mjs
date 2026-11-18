import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

const iterations = import.meta.dirname;
const ids = ["00-baseline", "01-result-focused", "02-trace-focused"];
const sha = (value) => createHash("sha256").update(value).digest("hex");
async function inventory(directory, prefix = "") {
  const entries = [];
  for (const name of (
    await readdir(path.join(directory, prefix), { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    if (["node_modules", ".gea", "dist"].includes(name.name)) continue;
    const relative = path.posix.join(prefix, name.name);
    if (name.isDirectory())
      entries.push(...(await inventory(directory, relative)));
    else
      entries.push({
        path: relative,
        sha256: sha(await readFile(path.join(directory, relative))),
      });
  }
  return entries;
}
const apply = (cwd, diff, ...flags) =>
  execFileSync("git", ["apply", "--unidiff-zero", ...flags, diff], {
    cwd,
    stdio: "pipe",
  });

test("each changes.diff ends with a newline", async () => {
  for (const id of ids) {
    const diff = await readFile(path.join(iterations, id, "changes.diff"));
    assert.equal(diff.at(-1), 0x0a, `${id}/changes.diff`);
  }
});

test("each changes.diff turns the previous snapshot into the next one", async () => {
  for (const [previous, next] of [ids.slice(0, 2), ids.slice(1)]) {
    const temp = await mkdtemp(path.join(tmpdir(), "iteration-diff-"));
    try {
      await cp(path.join(iterations, previous, "source"), temp, {
        recursive: true,
        filter: (entry) => path.basename(entry) !== "node_modules",
      });
      apply(temp, path.join(iterations, next, "changes.diff"));
      const manifest = JSON.parse(
        await readFile(path.join(iterations, next, "manifest.json"), "utf8"),
      );
      assert.deepEqual(await inventory(temp), manifest.files, next);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }
});

test("the baseline changes.diff is already applied to the baseline snapshot", async () => {
  // The baseline diff is relative to the original 5b43037 snapshot, which is
  // not kept here; reverse-applying it checks that it matches 00-baseline.
  const temp = await mkdtemp(path.join(tmpdir(), "iteration-diff-"));
  try {
    await cp(path.join(iterations, ids[0], "source"), temp, {
      recursive: true,
      filter: (entry) => path.basename(entry) !== "node_modules",
    });
    apply(temp, path.join(iterations, ids[0], "changes.diff"), "--check", "-R");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
