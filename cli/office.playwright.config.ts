import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
const installedChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const executablePath = process.env.ARTURO_OFFICE_TEST_BROWSER_PATH || (fs.existsSync(installedChrome) ? installedChrome : undefined);
export default defineConfig({
  testDir: "./office-tests",
  testMatch: "*.pw.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:4331", launchOptions: { executablePath }, screenshot: "only-on-failure" },
  webServer: { command: "npx ts-node scripts/officeFixture.ts", url: "http://127.0.0.1:4331", reuseExistingServer: false, timeout: 30_000, env: { EMAIL_NOTIFICATIONS: "false", ARTURO_OFFICE_TWILIO_ACCOUNT: "", ARTURO_OFFICE_XERO_TOKEN_FILE: "" } },
  projects: [{ name: "desktop", use: { viewport: { width: 1440, height: 1000 } } }, { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } }]
});
