import { defineConfig } from "@playwright/test";

// Smoke tests against a local ArkivAgent on 3101 with a built index (`pnpm index`, then `pnpm build`).
export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts/,
  timeout: 30_000,
  use: { baseURL: "http://localhost:3101", colorScheme: "dark", reducedMotion: "reduce" },
  webServer: { command: "pnpm start", port: 3101, reuseExistingServer: true, timeout: 60_000 },
});
