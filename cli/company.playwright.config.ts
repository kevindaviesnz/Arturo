import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

const installedChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath =
  process.env.ARTURO_COMPANY_TEST_BROWSER_PATH ||
  process.env.ARTURO_OFFICE_TEST_BROWSER_PATH ||
  (fs.existsSync(installedChrome) ? installedChrome : undefined);

// The test-only secrets `npm run test:run` uses; nothing here is real.
const secrets = {
  APPROVAL_SIGNING_SECRET: "test-approval-secret-000000000000",
  HUMAN_TASK_TOKEN_SECRET: "test-human-task-secret-000000000000",
  RUNTIME_REPLAY_ATTESTATION_SECRET: "test-replay-secret-000000000000000",
  API_SECRET_ENCRYPTION_KEY: "test-api-secret-encryption-key-00000000",
};

export default defineConfig({
  testDir: "./company-tests",
  testMatch: "*.pw.ts",
  workers: 1,
  timeout: 90_000,
  use: { baseURL: "http://127.0.0.1:4341", launchOptions: { executablePath }, screenshot: "only-on-failure" },
  webServer: {
    command: "npx ts-node scripts/companyFixture.ts",
    url: "http://127.0.0.1:4341",
    reuseExistingServer: false,
    timeout: 90_000,
    env: { ...secrets, ARTURO_COMPANY_TEST_PORT: "4341", EMAIL_NOTIFICATIONS: "false" },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
