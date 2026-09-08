import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

if (existsSync(".env")) process.loadEnvFile(".env");
const operation = process.argv[2] === "connect" ? "connect" : "dev";
const required =
  operation === "connect"
    ? ["MUSEDAM_MCP_CLIENT_ID"]
    : ["MUSEDAM_MCP_CLIENT_ID", "CREATIVE_REASONING_API_KEY"];
for (const name of required) {
  if (!process.env[name]?.trim()) {
    console.error(
      `Set ${name} in examples/ask-muse/.env (copy .env.example first).`,
    );
    process.exit(1);
  }
}

// npm installs a .cmd launcher on Windows; the arguments here are fixed.
const child = spawn(
  "gea",
  ["agent", operation, "--json-file", `agent-${operation}.json`],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error(
    "Could not start gea. Install the CLI version pinned in README.md.",
  );
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
