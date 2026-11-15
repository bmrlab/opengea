import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
const viewToken = (
  await readFile(new URL("../.gea/view-token", import.meta.url), "utf8")
).trim();
const child = spawn(
  "gea",
  [
    "agent",
    "dev",
    "--json",
    JSON.stringify({ cwd: ".", modelSource: "hosted" }),
  ],
  {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
    env: { ...process.env, RESEARCH_VIEW_TOKEN: viewToken },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  process.stderr.write("Could not start gea. Check CLI installation.\n");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
