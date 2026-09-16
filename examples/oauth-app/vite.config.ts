import { cloudflare } from "@cloudflare/vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Keep server builtin imports in one entry for GEA Runtime module loading.
  environments: {
    ssr: {
      build: { rollupOptions: { output: { inlineDynamicImports: true } } },
    },
  },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tanstackStart(),
    tailwindcss(),
    react(),
    {
      name: "gea-deployment-output",
      generateBundle: {
        order: "post",
        handler(_options, bundle) {
          // The Cloudflare adapter emits these for local preview. GEA uploads every file.
          delete bundle[".dev.vars"];
          delete bundle["wrangler.json"];
        },
      },
    },
  ],
});
