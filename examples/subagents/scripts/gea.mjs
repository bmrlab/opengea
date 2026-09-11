import { spawn } from "node:child_process";
import { env } from "./env.mjs";

const child = spawn(env.cli, process.argv.slice(2), {
  stdio: "inherit",
  shell: process.platform === "win32" && env.cli === "gea",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error(
    "Could not start GEA CLI. Set GEA_CLI_BIN to a compatible executable.",
  );
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
