import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { parseEnv } from "node:util";

export function developmentEnvironment(root: string) {
  const file = join(root, ".dev.vars");
  return {
    ...(existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {}),
    ...process.env,
  };
}

export function geaInstallation(environment = process.env) {
  let distributionRoot = environment.GEA_CLI_DISTRIBUTION_ROOT;
  if (
    !distributionRoot &&
    (!environment.GEA_CLI_BINARY ||
      !environment.GEA_WORKER_RUNTIME_BINARY ||
      !environment.WORKER_RUNTIME_SYSTEM_WORKER_ROOT)
  ) {
    const require = createRequire(import.meta.url);
    const cliRequire = createRequire(
      require.resolve("@gea-ai/cli/package.json"),
    );
    const target =
      process.platform === "darwin" && process.arch === "arm64"
        ? "darwin-arm64"
        : process.platform === "win32" && process.arch === "x64"
          ? "win32-x64"
          : null;
    if (!target)
      throw new Error(
        "Set GEA_CLI_BINARY, GEA_WORKER_RUNTIME_BINARY and WORKER_RUNTIME_SYSTEM_WORKER_ROOT for this platform.",
      );
    distributionRoot = dirname(
      cliRequire.resolve(`@gea-ai/cli-${target}/package.json`),
    );
  }
  const cli =
    environment.GEA_CLI_BINARY ??
    join(
      distributionRoot!,
      process.platform === "win32" ? "gea-windows-x64.exe" : "gea-darwin-arm64",
    );
  const runtime =
    environment.GEA_WORKER_RUNTIME_BINARY ??
    join(
      distributionRoot!,
      process.platform === "win32"
        ? "gea-worker-runtime.exe"
        : "gea-worker-runtime",
    );
  const systemWorkers =
    environment.WORKER_RUNTIME_SYSTEM_WORKER_ROOT ??
    join(distributionRoot!, "system-workers");
  for (const path of [cli, runtime, join(systemWorkers, "filesystem.mjs")]) {
    if (!existsSync(path))
      throw new Error(`GEA installation is incomplete: ${path}`);
  }
  return {
    cli: resolve(cli),
    runtime: resolve(runtime),
    systemWorkers: resolve(systemWorkers),
  };
}
