import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
  test: { fileParallelism: false, testTimeout: 30000, hookTimeout: 30000 },
});
