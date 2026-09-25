import { defineConfig, devices } from "@playwright/test";

const apiURL = "http://127.0.0.1:8001";
const webURL = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `sh -c "cd ../backend && rm -f e2e.sqlite3 && APP_ENV=test DATABASE_URL=sqlite:///./e2e.sqlite3 REDIS_URL=redis://127.0.0.1:6399/0 AI_MODE=deterministic CORS_ORIGINS=${webURL} python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8001"`,
      url: `${apiURL}/api/v1/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `NEXT_PUBLIC_API_URL=${apiURL} npm run dev -- --hostname 127.0.0.1 --port 3001`,
      url: webURL,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
