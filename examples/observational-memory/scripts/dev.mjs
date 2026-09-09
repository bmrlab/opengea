import { spawn } from "node:child_process";
import { readFile, mkdir, open } from "node:fs/promises";
import { createServer } from "node:net";
import { once } from "node:events";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeEnvironment } from "./environment.mjs";

export async function startAgent({ quiet = false, port } = {}) {
  const runtime = runtimeEnvironment();
  const config = JSON.parse(await readFile("agent-dev.json", "utf8"));
  if (port === 0) {
    const server = createServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    port = server.address().port;
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  if (port) config.port = port;
  await mkdir(".gea", { recursive: true });
  const log = quiet ? await open(".gea/verification-runtime.log", "a") : null;
  const child = spawn(
    runtime.cli,
    ["agent", "dev", "--json", JSON.stringify(config)],
    {
      env: runtime.env,
      stdio: quiet ? ["ignore", log.fd, log.fd] : "inherit",
    },
  );
  let startupError;
  child.on("error", (error) => {
    startupError = error;
  });
  const url = `http://127.0.0.1:${config.port}`;
  const stop = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
      try {
        await exited;
      } finally {
        clearTimeout(timer);
      }
    }
    await log?.close();
  };
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (startupError) throw startupError;
      if (child.exitCode !== null)
        throw new Error(
          `Agent exited (${child.exitCode}); inspect .gea/verification-runtime.log.`,
        );
      try {
        // A private session query proves that the Agent bundle and native DO route are ready.
        const response = await fetch(
          `${url}/gea/agents/sessions/readiness/v1/model-context`,
          { signal: AbortSignal.timeout(1000) },
        );
        if (response.ok) return { url, stop, models: runtime.models };
      } catch {
        /* The startup probe retries until the local listener is ready. */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(
      "Agent did not become ready; inspect .gea/verification-runtime.log.",
    );
  } catch (error) {
    await stop();
    throw error;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const agent = await startAgent();
  console.log(`Observations Agent: ${agent.url}/gea/agents/run`);
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => void agent.stop());
}
