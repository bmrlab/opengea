import { Miniflare, Log, LogLevel } from "miniflare";
import {
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { DatabaseSync } from "node:sqlite";

const names = {
  LOGIN_FLOWS: "LoginFlow",
  OAUTH_SESSIONS: "OAuthSession",
  CONVERSATION_RUNS: "ConversationRuns",
};

export async function createTestRuntime(bindings: Record<string, string>) {
  const bundle = process.env.GEA_TEST_WORKER_DIR;
  const manifest = bundle
    ? JSON.parse(await readFile(join(bundle, "gea.agent-package.json"), "utf8"))
        .workerManifest
    : null;
  const main = manifest?.main ?? "dist/server/index.js";
  const objectBindings: Array<{
    name: string;
    className: string;
    namespace?: string;
  }> =
    manifest?.durableObjectBindings ??
    Object.entries(names).map(([name, className]) => ({
      name,
      className,
      namespace: "worker",
    }));
  const root = await mkdtemp(join(tmpdir(), "opengea-oauth-sqlite-"));
  if (process.env.GEA_WORKER_RUNTIME_BIN)
    await cp(bundle ?? resolve("dist"), bundle ? root : join(root, "dist"), {
      recursive: true,
    });
  let mf: Miniflare | undefined;
  let child: ChildProcess | undefined;
  let runtimeOrigin = "";
  let logs = "";
  async function start() {
    if (!process.env.GEA_WORKER_RUNTIME_BIN) {
      mf = new Miniflare({
        name: "oauth-app",
        modules: true,
        scriptPath: resolve(bundle ?? ".", main),
        modulesRules: [
          { type: "ESModule", include: ["**/*.js"], fallthrough: true },
        ],
        compatibilityDate: "2026-03-12",
        compatibilityFlags: ["nodejs_compat"],
        bindings,
        assets: {
          directory: resolve("dist/client"),
          binding: "ASSETS",
          routerConfig: { has_user_worker: true },
        },
        durableObjects: Object.fromEntries(
          Object.entries(names).map(([name, className]) => [
            name,
            { className, useSQLite: true },
          ]),
        ),
        durableObjectsPersist: join(root, "data"),
        log: new Log(LogLevel.ERROR),
      });
      await mf.ready;
      return;
    }
    const listener = createServer();
    listener.listen(0, "127.0.0.1");
    await once(listener, "listening");
    const address = listener.address();
    if (!address || typeof address === "string")
      throw new Error("Could not allocate runtime port");
    await new Promise<void>((resolve) => listener.close(() => resolve()));
    runtimeOrigin = `http://127.0.0.1:${address.port}`;
    const config = join(root, "runtime.json");
    await writeFile(
      config,
      JSON.stringify({
        dataRoot: join(root, "data"),
        durableObjects: { mode: "local" },
        deployments: [
          {
            name: "oauth-app",
            main,
            moduleRoot: main.slice(0, main.lastIndexOf("/")),
            assets: { directory: "dist/client", binding: "ASSETS" },
            routes: [{ pathPrefix: "/" }],
            vars: bindings,
            durableObjectBindings: Object.fromEntries(
              objectBindings.map(({ name, className, namespace }) => [
                name,
                { className, ...(namespace ? { namespace } : {}) },
              ]),
            ),
            durableObjectNamespace: "018f0000-0000-7000-8000-000000000099",
            durableObjectIdScope: "worker",
            requiredCapabilities: ["durable-object-worker-namespace-v1"],
            compatibilityDate: "2026-09-15",
            compatibilityFlags: ["nodejs_compat"],
          },
        ],
      }),
    );
    child = spawn(process.env.GEA_WORKER_RUNTIME_BIN, [], {
      env: {
        ...process.env,
        WORKER_RUNTIME_CONFIG: config,
        WORKER_RUNTIME_LISTEN_ADDR: `127.0.0.1:${address.port}`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    logs = "";
    for (const stream of [child.stdout, child.stderr])
      stream?.on("data", (chunk) => {
        logs += chunk;
      });
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null)
        throw new Error(`GEA Runtime exited: ${logs}`);
      const response = await fetch(`${runtimeOrigin}/healthz`).catch(
        () => null,
      );
      if (response?.ok) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`GEA Runtime did not start: ${logs}`);
  }
  async function stop() {
    if (mf) {
      await mf.dispose();
      mf = undefined;
    }
    if (child && child.exitCode === null) {
      child.kill("SIGTERM");
      await once(child, "exit");
    }
    child = undefined;
  }
  async function databaseFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) files.push(...(await databaseFiles(path)));
      else if (entry.name.endsWith(".sqlite")) files.push(path);
    }
    return files;
  }
  try {
    await start();
  } catch (error) {
    await stop();
    await rm(root, { recursive: true, force: true });
    throw error;
  }
  return {
    async fetch(request: Request): Promise<Response> {
      const init = {
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body: request.body
          ? new Uint8Array(await request.arrayBuffer())
          : undefined,
        redirect: "manual" as const,
      };
      if (mf) {
        const response = await mf.dispatchFetch(request.url, init);
        return new Response(
          response.body as ReadableStream<Uint8Array> | null,
          { status: response.status, headers: [...response.headers] },
        );
      }
      const url = new URL(request.url);
      return fetch(`${runtimeOrigin}${url.pathname}${url.search}`, {
        ...init,
        headers: {
          ...init.headers,
          "x-forwarded-host": url.host,
          "x-forwarded-proto": url.protocol.slice(0, -1),
        },
      });
    },
    async restart(overrides: Record<string, string> = {}) {
      await stop();
      Object.assign(bindings, overrides);
      await start();
    },
    // Inspect/age real persisted SQLite only while the runtime is stopped; no test-only production RPCs.
    async inspectSqlite(sql?: {
      table: "flow" | "session";
      statement: string;
    }) {
      await stop();
      const payloads: string[] = [];
      for (const path of await databaseFiles(join(root, "data"))) {
        const db = new DatabaseSync(path);
        try {
          const tables = db
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all();
          for (const table of ["flow", "session"] as const) {
            if (!tables.some((row) => row.name === table)) continue;
            if (sql?.table === table) db.exec(sql.statement);
            for (const row of db.prepare(`SELECT payload FROM ${table}`).all())
              payloads.push(String(row.payload));
          }
        } finally {
          db.close();
        }
      }
      await start();
      return payloads;
    },
    async dispose() {
      await stop();
      await rm(root, { recursive: true, force: true });
    },
    get logs() {
      return logs;
    },
  };
}
