import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [stage, output] = process.argv.slice(2);
const stages = ["v1-research", "v2-workbench", "v3-feishu"];
if (!stages.includes(stage) || !output) {
  throw new Error(
    "Usage: node scripts/materialize.mjs v1-research|v2-workbench|v3-feishu /path/to/new-project",
  );
}
const source = path.resolve(import.meta.dirname, "..");
const target = path.resolve(output);
// A fresh destination keeps the user's source and previous results intact.
await mkdir(target, { recursive: false });
const common = [
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".gitignore",
  "tsconfig.json",
  "agent.ts",
  "instructions.ts",
  "worker.ts",
  "gea.worker.json",
  "connectors/search.ts",
  "tools/search-sources.ts",
  "tools/read-source.ts",
  "lib/evidence.ts",
  "benchmarks",
  "tests/evidence.test.mjs",
  "tests/note-detail.test.mjs",
];
const full = [
  "bindings.d.ts",
  "durable-objects",
  "lib/research.ts",
  "tools/research-record.ts",
  "app",
  "tests/app.test.mjs",
  "tests/store.test.mjs",
  "scripts/prepare-local.mjs",
  "scripts/dev.mjs",
  "scripts/configure-app.mjs",
];
for (const file of [...common, ...(stage === "v1-research" ? [] : full)]) {
  await mkdir(path.dirname(path.join(target, file)), { recursive: true });
  await cp(path.join(source, file), path.join(target, file), {
    recursive: true,
    filter: (entry) =>
      !["node_modules", ".gea", "dist", ".env"].includes(
        path.basename(entry),
      ) && !path.basename(entry).startsWith(".env."),
  });
}
for (const file of await readdir(path.join(source, "versions", stage))) {
  if (file !== "README.md")
    await cp(
      path.join(source, "versions", stage, file),
      path.join(target, file),
    );
}
if (stage === "v1-research") {
  const pkg = JSON.parse(
    await readFile(path.join(target, "package.json"), "utf8"),
  );
  pkg.scripts = {
    "type-check": "tsc --noEmit",
    test: "node --test tests/*.test.mjs",
    dev: `gea agent dev --json '{"cwd":".","modelSource":"hosted"}'`,
  };
  await writeFile(
    path.join(target, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );
}
await writeFile(
  path.join(target, "README.md"),
  `# Desk Research — ${stage}\n\nGenerated from OpenGEA. Install with \`pnpm install --frozen-lockfile\`, then run \`pnpm type-check\` and \`pnpm test\`. Configure GEA login, Workspace and \`gea connector --list\` before \`pnpm dev\`.\n\n${stage !== "v1-research" ? "Run `pnpm prepare:local` before dev. Configure the workbench with `scripts/configure-app.mjs`, then `pnpm app`. See the source tutorial for actual origin/key-file arguments.\n\n" : "This stage provides search only; it has no research DO or frontend.\n\n"}${stage === "v3-feishu" ? "Configure the Feishu test bot variables and sender allowlist before startup.\n\n" : ""}Use explicit benchmark paths: \`benchmarks/single-turn\` and \`benchmarks/multi-turn\`. The latter remains local-only. Full instructions: https://github.com/bmrlab/opengea/tree/main/examples/desk-research\n`,
);
console.log(`Created ${stage}: ${target}`);
