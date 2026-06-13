import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run preview -- --port 4175",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: true,
    timeout: 20_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});

