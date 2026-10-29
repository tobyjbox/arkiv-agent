import { defineConfig } from "@playwright/test";

// Smoke tests against this checkout's build (`pnpm index`, then `pnpm build`), on PORT (default 3101).
// Playwright starts the server itself and refuses to run if something already listens there, so it
// never tests another checkout's build. E2E_REUSE_SERVER=1 reuses a server you know is this build.
const port = Number(process.env.PORT) || 3101;

export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts/,
  timeout: 30_000,
  use: { baseURL: `http://localhost:${port}`, colorScheme: "dark", reducedMotion: "reduce" },
  webServer: { command: "pnpm start", url: `http://127.0.0.1:${port}/catalogue`, env: { PORT: String(port) }, reuseExistingServer: process.env.E2E_REUSE_SERVER === "1", timeout: 60_000 },
});
