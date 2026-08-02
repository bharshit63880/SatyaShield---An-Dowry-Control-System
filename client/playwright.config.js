import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'npm.cmd run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    env: {
      VITE_API_URL: 'http://127.0.0.1:5000/api/v1',
      VITE_REPORTER_INACTIVITY_SECONDS: '120',
      VITE_REPORTER_LOCK_WARNING_SECONDS: '10'
    },
    reuseExistingServer: false,
    timeout: 60_000
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'small-mobile', use: { ...devices['iPhone SE'], browserName: 'chromium' } }
  ]
});
