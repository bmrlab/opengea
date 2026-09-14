import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: {
    alias: { "server-only": new URL("./tests/server-only.ts", import.meta.url).pathname },
  },
  test: { fileParallelism: false, testTimeout: 15000, hookTimeout: 30000 },
});
