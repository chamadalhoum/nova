import { defineConfig, devices } from "@playwright/test";

function readPort(name: string, fallback: number) {
  const raw = process.env[name] || String(fallback);
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a numeric TCP port`);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`${name} must be between 1 and 65535`);
  return String(port);
}

const apiPort = readPort("E2E_API_PORT", 8001);
const webPort = readPort("E2E_WEB_PORT", 3001);
const apiURL = `http://127.0.0.1:${apiPort}`;
const webURL = `http://127.0.0.1:${webPort}`;

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
      command: `sh -c "cd ../backend && rm -f e2e.sqlite3 && APP_ENV=test DATABASE_URL=sqlite:///./e2e.sqlite3 REDIS_URL=redis://127.0.0.1:6399/0 AI_MODE=deterministic CORS_ORIGINS=${webURL} python3 -m uvicorn app.main:app --host 127.0.0.1 --port ${apiPort}"`,
      url: `${apiURL}/api/v1/health`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: `NEXT_PUBLIC_API_URL=${apiURL} npm run dev -- --hostname 127.0.0.1 --port ${webPort}`,
      url: webURL,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
