import { geaWorkerDev } from "./scripts/gea-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  server: { strictPort: true },
  optimizeDeps: { noDiscovery: true },
  environments: {
    ssr: {
      resolve: {
        noExternal: true,
        external: [
          "cloudflare:workers",
          "node:async_hooks",
          "node:stream",
          "node:stream/web",
        ],
        conditions: ["workerd", "worker", "browser"],
      },
      build: {
        rollupOptions: {
          input: "src/worker.ts",
          external: [
            "cloudflare:workers",
            "node:async_hooks",
            "node:stream",
            "node:stream/web",
          ],
          output: { inlineDynamicImports: true, entryFileNames: "index.js" },
        },
      },
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  plugins: [
    geaWorkerDev(),
    tanstackStart({ vite: { installDevServerMiddleware: false } }),
    tailwindcss(),
    react(),
  ],
});
