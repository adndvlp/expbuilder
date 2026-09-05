import { defineConfig, devices } from "@playwright/test";

const port = process.env.RUNTIME_SERVER_PORT;
const dbRoot = process.env.RUNTIME_DB_ROOT;
if (!port || !dbRoot) {
  throw new Error("Runtime tests must be started through runtime-e2e/run.mjs");
}
const serverUrl = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./runtime-e2e/scenarios",
  outputDir: "./runtime-e2e/artifacts",
  globalTeardown: "./runtime-e2e/globalTeardown.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "runtime-report" }]],
  use: {
    baseURL: serverUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "runtime-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node ../server/api.js",
    url: `${serverUrl}/api/load-experiments`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      DB_ROOT: dbRoot,
      PORT: port,
      ORIGIN: serverUrl,
    },
  },
});
