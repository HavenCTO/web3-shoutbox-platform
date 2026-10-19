import { defineConfig, devices } from '@playwright/test'

// E2E runs on dedicated ports (app 3100, Gun relay 8765) so it never reuses a
// developer's dev server — the app must be wired to the test relay or the two
// visitors in a test can never discover each other.
const E2E_PORT = 3100
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`
const GUN_RELAY_URL = 'http://localhost:8765/gun'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: 'npm run relay',
          url: 'http://localhost:8765/gun',
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        {
          command: `npx vite --port ${E2E_PORT} --strictPort`,
          url: E2E_BASE_URL,
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            VITE_GUN_RELAY_PEERS: GUN_RELAY_URL,
          },
        },
      ],
})
