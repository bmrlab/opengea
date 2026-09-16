import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer, request as proxyRequest } from "node:http";
import type { Plugin } from "vite";
import { developmentEnvironment, geaInstallation } from "./runtime";

async function reservePort() {
  const listener = createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  if (!address || typeof address === "string")
    throw new Error("Could not allocate development port.");
  await new Promise<void>((resolve) => listener.close(() => resolve()));
  return address.port;
}

// Vite owns the browser origin; the native Runtime owns all application execution.
// Build/reload is CLI-owned so a failed build keeps the previous Worker available.
export function geaWorkerDev(): Plugin {
  let stopWorker: (() => Promise<void>) | undefined;
  return {
    async closeBundle() {
      await stopWorker?.();
    },
    name: "gea-worker-dev",
    apply: "serve",
    async configureServer(server) {
      const environment = developmentEnvironment(server.config.root);
      const installation = geaInstallation(environment);
      const port = await reservePort();
      const apiPort = await reservePort();
      const origin = `http://127.0.0.1:${port}`;
      const agentEnvironment = environment.AGENT_ENVIRONMENT ?? "local";
      if (
        agentEnvironment === "local" &&
        server.config.server.host !== "127.0.0.1"
      )
        throw new Error(
          "Local Agents API development must bind Vite to 127.0.0.1.",
        );
      const child = spawn(
        installation.cli,
        [
          "agent",
          "dev",
          "--json",
          JSON.stringify({
            cwd: server.config.root,
            host: "127.0.0.1",
            port,
            apiPort,
            vite: false,
            buildCommand: [
              process.execPath,
              "node_modules/vite/bin/vite.js",
              "build",
            ],
          }),
        ],
        {
          cwd: server.config.root,
          env: {
            ...environment,
            APP_ORIGIN:
              environment.APP_ORIGIN ??
              `http://127.0.0.1:${server.config.server.port ?? 4000}`,
            AGENT_ENVIRONMENT: agentEnvironment,
            ...(agentEnvironment === "local"
              ? { LOCAL_AGENTS_API_URL: `http://127.0.0.1:${apiPort}` }
              : {}),
            NODE_ENV: "production",
            GEA_WORKER_RUNTIME_BINARY: installation.runtime,
            WORKER_RUNTIME_SYSTEM_WORKER_ROOT: installation.systemWorkers,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      let stopping: Promise<void> | undefined;
      const stop = () =>
        (stopping ??= (async () => {
          if (
            !child.pid ||
            child.exitCode !== null ||
            child.signalCode !== null
          )
            return;
          const exited = once(child, "exit");
          child.kill("SIGTERM");
          await exited;
        })());
      stopWorker = stop;
      // Vite creates a replacement server before closing the old one. Release
      // this project's single-owner SQLite database before replacement startup.
      const restart = server.restart.bind(server);
      server.restart = async (force) => {
        await stop();
        await restart(force);
      };
      server.httpServer?.once("close", () => {
        void stop();
      });
      child.stdout.on("data", (chunk) => process.stdout.write(chunk));
      child.stderr.on("data", (chunk) => {
        process.stderr.write(chunk);
        output += chunk;
        const lines = output.split("\n");
        output = lines.pop()!;
        if (
          lines.some(
            (line) =>
              line.startsWith("[gea] Agent Worker reloaded at deployment ") ||
              line === "[gea] Agent Worker Runtime restarted.",
          )
        )
          server.ws.send({ type: "full-reload" });
      });
      let startupError: Error | undefined;
      child.once("error", (error) => {
        startupError = error;
      });
      try {
        const deadline = Date.now() + 60000;
        while (true) {
          if (startupError) throw startupError;
          if (child.exitCode !== null || child.signalCode !== null)
            throw new Error(
              "GEA development process exited. See its output above.",
            );
          try {
            const response = await fetch(`${origin}/gea/agents`);
            await response.body?.cancel();
            if (response.ok || response.status === 404) break;
          } catch {
            /* The CLI is still building or starting the Runtime. */
          }
          if (Date.now() > deadline)
            throw new Error("GEA development startup timed out.");
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      } catch (error) {
        await stop();
        throw error;
      }
      // Let Vite own its HMR client and WebSocket. Everything else goes to the Worker.
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", origin).pathname;
        if (
          pathname.startsWith("/@vite/") ||
          pathname.startsWith("/@id/") ||
          (pathname.startsWith("/node_modules/") &&
            pathname.endsWith("/vite/dist/client/env.mjs"))
        )
          return next();
        const upstream = proxyRequest(
          new URL(request.url ?? "/", origin),
          {
            method: request.method,
            headers: {
              ...request.headers,
              "x-forwarded-host": request.headers.host ?? "",
              "x-forwarded-proto": "http",
            },
          },
          (incoming) => {
            incoming.on("error", (error) => response.destroy(error));
            const html =
              incoming.headers["content-type"]?.includes("text/html");
            const headers = { ...incoming.headers };
            if (html) delete headers["content-length"];
            response.writeHead(incoming.statusCode ?? 502, headers);
            if (!html) return void incoming.pipe(response);
            const chunks: Buffer[] = [];
            incoming.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            incoming.on("end", () =>
              response.end(
                Buffer.concat(chunks)
                  .toString("utf8")
                  .replace(
                    "</head>",
                    '<script type="module" src="/@vite/client"></script></head>',
                  ),
              ),
            );
          },
        );
        upstream.on("error", (error) => {
          if (response.headersSent) response.destroy(error);
          else response.writeHead(502).end("GEA Worker is unavailable.");
        });
        response.once("close", () => {
          if (!response.writableEnded) upstream.destroy();
        });
        request.pipe(upstream);
      });
    },
  };
}
