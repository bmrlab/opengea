import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { geaInstallation } from "@gea-ai/cli/runtime";
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
    // Local verification reports tokens, without assigning provider prices.
    pricing: Object.fromEntries(
      [main, memory].map((model) => [
        `creative-reasoning/${model}`,
        {
          providerRates: {
            inputMicrosPerMillion: 0,
            outputMicrosPerMillion: 0,
          },
        },
      ]),
    ),
    providers: {
      "creative-reasoning": {
        type: "creative-reasoning",
        apiKeyEnv: "CREATIVE_REASONING_API_KEY",
        baseURLEnv: "CREATIVE_REASONING_BASE_URL",
        includeUsage: true,
      },
    },
  };
  const installation = geaInstallation();
  const distributionRoot = dirname(installation.cli);
  return {
    // Own the native process so stop/restart also shuts down its Runtime.
    cli: process.env.GEA_CLI_BIN?.trim() || installation.cli,
    models: { main, memory },
    env: {
      ...process.env,
      GEA_CLI_DISTRIBUTION_ROOT:
        process.env.GEA_CLI_DISTRIBUTION_ROOT || distributionRoot,
      CREATIVE_REASONING_BASE_URL: "https://api.creative-reasoning.com",
      LLM_MODEL_CATALOG_JSON: JSON.stringify(catalog),
    },
  };
}
