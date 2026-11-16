import { defineConfig } from "vitest/config";

/**
 * Vitest configuration. Separate from vite.config.ts so test runs do not
 * pull in the frontend build plugin chain.
 *
 * Default environment is node; DOM tests opt in with a per-file
 * `@vitest-environment jsdom` comment.
 */
export default defineConfig({
  // JSX in test files uses the automatic runtime (no React import needed).
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["tests/setup.ts"],
    testTimeout: 30_000,
  },
});
