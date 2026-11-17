import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const [action, id] = process.argv.slice(2);
if (
  !["create", "verify"].includes(action) ||
  !/^(?:history\/)?[0-9]{2}-[a-z0-9-]+$/u.test(id ?? "")
)
  throw new Error(
    "Usage: node scripts/snapshot-iteration.mjs create|verify 00-baseline (from example root)",
  );
if (action === "create" && id.startsWith("history/"))
  throw new Error("Historical snapshots are read-only.");
const root = process.cwd();
const directory = path.join(root, "iterations", id);
const source = path.join(directory, "source");
const sha = (value) => createHash("sha256").update(value).digest("hex");
async function inventory(directory, prefix = "") {
  const entries = [];
  for (const name of (
    await readdir(path.join(directory, prefix), { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const relative = path.join(prefix, name.name);
    if (name.isSymbolicLink())
      throw new Error(`Snapshot cannot contain a symlink: ${relative}`);
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
if (action === "create") {
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory); // Existing iteration IDs are immutable.
  await mkdir(source);
  const files = [
    "agent.ts",
    "instructions.ts",
    "worker.ts",
    "gea.worker.json",
    "bindings.d.ts",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    ".gitignore",
    "connectors",
    "tools",
    "lib",
    "durable-objects",
    "benchmarks",
    "evaluation",
    "iterations/analyze-eval.mjs",
    "iterations/analyze-eval.test.mjs",
    "app",
    "scripts",
    "tests",
    "versions",
  ];
  for (const file of files)
    await cp(path.join(root, file), path.join(source, file), {
      recursive: true,
      filter: (entry) =>
        !["node_modules", ".gea", "dist", ".env"].includes(
          path.basename(entry),
        ) && !path.basename(entry).startsWith(".env."),
    });
  const entries = await inventory(source);
  const manifest = {
    id,
    createdAt: new Date().toISOString(),
    node: process.version,
    cli: execFileSync("gea", ["--version"], { encoding: "utf8" }).trim(),
    npm: execFileSync("npm", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim(),
    packageManager: JSON.parse(
      await readFile(path.join(root, "package.json"), "utf8"),
    ).packageManager,
    sourceSha256: sha(JSON.stringify(entries)),
    benchmarkSha256: sha(
      JSON.stringify(
        entries.filter((file) => file.path.startsWith("benchmarks/")),
      ),
    ),
    files: entries,
  };
  await writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      id,
      sourceSha256: manifest.sourceSha256,
      benchmarkSha256: manifest.benchmarkSha256,
      files: entries.length,
    }),
  );
} else {
  const manifest = JSON.parse(
    await readFile(path.join(directory, "manifest.json"), "utf8"),
  );
  const entries = await inventory(source);
  if (
    sha(JSON.stringify(entries)) !== manifest.sourceSha256 ||
    JSON.stringify(entries) !== JSON.stringify(manifest.files)
  )
    throw new Error(
      `Iteration ${id} source changed; restore it before comparing results.`,
    );
  console.log(
    JSON.stringify({ id, verified: true, sourceSha256: manifest.sourceSha256 }),
  );
}
