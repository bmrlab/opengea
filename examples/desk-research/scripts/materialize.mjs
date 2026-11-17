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
  "lib/research.ts",
  "lib/research-brief.ts",
  "lib/source-passages.ts",
  "benchmarks",
  "evaluation",
  "iterations/analyze-eval.mjs",
  "iterations/analyze-eval.test.mjs",
  "tests/evidence.test.mjs",
  "tests/source-content.test.mjs",
  "tests/source-passages.test.mjs",
];
const full = [
  "bindings.d.ts",
  "durable-objects",
  "tools/research-record.ts",
  "app",
  "tests/app.test.mjs",
  "tests/store.test.mjs",
  "tests/structured-save.test.mjs",
  "tests/save-feedback.test.mjs",
  "tests/research-brief.test.mjs",
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
    test: pkg.scripts.test,
    dev: `gea agent dev --json '{"cwd":".","modelSource":"local"}'`,
  };
  await writeFile(
    path.join(target, "package.json"),
    JSON.stringify(pkg, null, 2) + "\n",
  );
}
await writeFile(
  path.join(target, "README.md"),
  `# Desk Research — ${stage}\n\nGenerated from OpenGEA. Install with \`pnpm install --frozen-lockfile\`, then run \`pnpm type-check\` and \`pnpm test\`. Inject your CR key as \`CREATIVE_REASONING_API_KEY\` into the CLI environment for direct model calls (\`modelSource: "local"\`). Never put it in source or generated files. Configure GEA login, Workspace and \`gea agent connect research-search\` before \`pnpm dev\`.\n\n${stage !== "v1-research" ? "Run `pnpm prepare:local` before dev. Configure the workbench with `scripts/configure-app.mjs`, then `pnpm app`. See the source README for actual origin/key-file arguments.\n\n" : "This stage provides search only; it has no research DO or frontend.\n\n"}${stage === "v3-feishu" ? "Configure the Feishu test bot variables and sender allowlist before startup; see https://github.com/bmrlab/opengea/blob/main/examples/desk-research/FEISHU.md.\n\n" : ""}Use explicit benchmark paths: \`benchmarks/single-turn\` and \`benchmarks/multi-turn\`. The latter remains local-only. Use \`judgeModel: "creative-reasoning-1.5"\` and \`modelSource: "local"\` for evaluations; the generated Simulator cases use the same CR model. Full instructions: https://github.com/bmrlab/opengea/tree/main/examples/desk-research\n`,
);
console.log(`Created ${stage}: ${target}`);
