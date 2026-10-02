import { geaWorker } from "@gea-ai/cli/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  server: { strictPort: true },
  optimizeDeps: { noDiscovery: true },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  plugins: [
    geaWorker(),
    tanstackStart({ vite: { installDevServerMiddleware: false } }),
    tailwindcss(),
    react(),
  ],
});
