import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
const cli = process.env.GEA_CLI_BIN?.trim() || "gea";
const child = spawn(cli, process.argv.slice(2), {
  stdio: "inherit",
  shell: process.platform === "win32" && cli === "gea",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(`Could not start GEA CLI: ${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
