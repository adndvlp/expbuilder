import { defineConfig, devices } from "@playwright/test";

const TEST_ENV = {
  VITE_FIREBASE_API_KEY: "AIzaSyTestKey00000000000000000000000",
  VITE_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "test-project",
  VITE_FIREBASE_STORAGE_BUCKET: "test-project.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  VITE_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000000000",
  VITE_API_URL: "http://localhost:3000",
  VITE_DATA_API_URL: "http://localhost:3000/api/data",
};

export default defineConfig({
  testDir: "./e2e/tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { outputFolder: "playwright-report" }],
    ["list"],
  ],
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: TEST_ENV,
  },
});
