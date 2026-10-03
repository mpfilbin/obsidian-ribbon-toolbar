import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte({ hot: false, compilerOptions: { css: "injected" } })],
  resolve: {
    alias: {
      // The real package is types-only; see tests/support/obsidian.ts.
      obsidian: fileURLToPath(new URL("./tests/support/obsidian.ts", import.meta.url)),
    },
    // Resolve Svelte's client runtime so components can be mounted in jsdom.
    conditions: ["browser"],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,svelte}"],
      exclude: ["src/**/types.ts", "src/plugin-contract.ts"],
    },
  },
});
