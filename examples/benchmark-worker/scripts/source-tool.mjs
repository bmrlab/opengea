import { spawn } from "node:child_process";
import path from "node:path";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
const [mode] = process.argv.slice(2);
const source = process.env.GEA_SOURCE;
if (!source)
  throw new Error(
    "Set GEA_SOURCE to an installed source build directory (see README).",
  );
const project = process.cwd();
await mkdir(path.resolve("dist"), { recursive: true });
let args;
if (mode === "build")
  args = [
    "scripts/build-benchmark-app.ts",
    project,
    path.resolve("dist/bundle"),
    process.env.GEA_PROJECT_SLUG || "search-example",
  ];
else if (mode === "dev") {
  if (!process.env.GEA_RUNTIME || !process.env.GEA_SYSTEM_WORKERS)
    throw new Error("Set GEA_RUNTIME and GEA_SYSTEM_WORKERS.");
  args = [
    "scripts/benchmark-app.ts",
    project,
    path.resolve(".local/state"),
    process.env.GEA_RUNTIME,
    process.env.GEA_SYSTEM_WORKERS,
  ];
} else throw new Error("Expected build or dev");
const child = spawn(process.execPath, ["--import", "tsx", ...args], {
  cwd: path.join(source, "packages/bench"),
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", async (code) => {
  process.exitCode = code ?? 1;
  if (code === 0 && mode === "build") {
    await mkdir("dist/worker", { recursive: true });
    for (const file of ["worker.mjs", "snapshot.json"])
      await copyFile(`dist/bundle/${file}`, `dist/worker/${file}`);
    const registration = JSON.parse(
      await readFile("dist/bundle/registration.json", "utf8"),
    );
    registration.snapshotPath = "dist/worker/snapshot.json";
    await writeFile(
      "dist/registration.json",
      JSON.stringify(registration, null, 2),
    );
  }
});
