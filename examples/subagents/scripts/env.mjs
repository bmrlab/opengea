import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
if (process.env.GEA_ENV_FILE) process.loadEnvFile(process.env.GEA_ENV_FILE);

export const env = {
  cli: process.env.GEA_CLI_BIN?.trim() || "gea",
  api: process.env.GEA_AGENT_URL?.trim(),
  apiKey: process.env.GEA_PROJECT_API_KEY?.trim(),
  localApi:
    process.env.GEA_LOCAL_AGENT_URL?.trim() ||
    "http://127.0.0.1:8793/gea/agents/coordinator",
};
