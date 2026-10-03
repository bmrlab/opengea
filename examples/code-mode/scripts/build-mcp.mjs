import { build } from "esbuild";
import { fileURLToPath } from "node:url";
await build({
  entryPoints: [fileURLToPath(new URL("../mcp/worker.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../mcp/dist/worker.mjs", import.meta.url)),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
});
