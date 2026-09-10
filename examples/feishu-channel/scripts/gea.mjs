import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
if (process.env.GEA_ENV_FILE) process.loadEnvFile(process.env.GEA_ENV_FILE);

const args = process.argv.slice(2);
if (args[0] === "agent" && args[1] === "dev") {
  for (const name of [
    "CREATIVE_REASONING_API_KEY",
    "FEISHU_APP_ID",
    "FEISHU_APP_SECRET",
    "FEISHU_ALLOWED_SENDERS",
  ]) {
    if (!process.env[name]?.trim()) {
      console.error(`Set ${name} in .env before starting the Feishu receiver.`);
      process.exit(1);
    }
  }
}

const cli = process.env.GEA_CLI_BIN?.trim() || "gea";
const child = spawn(cli, args, {
  stdio: "inherit",
  // The default npm launcher is a .cmd file on Windows.
  shell: process.platform === "win32" && cli === "gea",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error(
    "Could not start GEA CLI. Set GEA_CLI_BIN to its executable path.",
  );
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
