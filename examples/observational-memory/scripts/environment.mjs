import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import geaLauncher from "@gea-ai/cli/gea-launcher.cjs";
import { MAIN_MODEL, MEMORY_MODEL } from "../models.ts";

export function runtimeEnvironment() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  if (process.env.GEA_ENV_FILE) process.loadEnvFile(process.env.GEA_ENV_FILE);
  const key = process.env.CREATIVE_REASONING_API_KEY;
  if (!key?.trim()) throw new Error("Set CREATIVE_REASONING_API_KEY in .env.");
  const main = process.env.MAIN_MODEL || MAIN_MODEL;
  const memory = process.env.MEMORY_MODEL || MEMORY_MODEL;
  const catalog = {
    default: MAIN_MODEL,
    models: [
      { id: MAIN_MODEL, target: `creative-reasoning/${main}` },
      { id: MEMORY_MODEL, target: `creative-reasoning/${memory}` },
    ],
    providers: {
      "creative-reasoning": {
        type: "creative-reasoning",
        apiKeyEnv: "CREATIVE_REASONING_API_KEY",
        baseURLEnv: "CREATIVE_REASONING_BASE_URL",
        includeUsage: true,
      },
    },
  };
  const { packageName, executable } = geaLauncher.resolveGeaTarget(
    process.platform,
    process.arch,
  );
  const cliRequire = createRequire(
    import.meta.resolve("@gea-ai/cli/package.json"),
  );
  const distributionRoot = dirname(
    cliRequire.resolve(`${packageName}/package.json`),
  );
  return {
    // Own the native process so stop/restart also shuts down its Runtime.
    cli: join(distributionRoot, executable),
    models: { main, memory },
    env: {
      ...process.env,
      GEA_CLI_DISTRIBUTION_ROOT: distributionRoot,
      CREATIVE_REASONING_BASE_URL: "https://api.creative-reasoning.com",
      LLM_MODEL_CATALOG_JSON: JSON.stringify(catalog),
    },
  };
}
