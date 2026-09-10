import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
if (existsSync(".env")) process.loadEnvFile(".env");
if (!process.env.CREATIVE_REASONING_API_KEY?.trim()) {
  console.error(
    "Set CREATIVE_REASONING_API_KEY in examples/basic/.env (run pnpm setup:env first).",
  );
  process.exit(1);
}
const operation = process.argv[2] === "eval" ? "eval" : "dev";
// npm installs a .cmd launcher on Windows; all shell arguments here are fixed by this script.
const child = spawn(
  "gea",
  ["agent", operation, "--json-file", `agent-${operation}.json`],
  {
    stdio: "inherit",
    // Benchmarks have no interactive approver; keep the browser demo's default.
    env:
      operation === "eval"
        ? { ...process.env, REQUIRE_SEARCH_APPROVAL: "false" }
        : process.env,
    shell: process.platform === "win32",
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error(
    "Could not start gea. Install the supported-platform CLI described in README.md.",
  );
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
