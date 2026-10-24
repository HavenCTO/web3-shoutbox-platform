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
          // The relay parks plain GETs to /gun (websocket handoff), so the
          // readiness probe uses its health endpoint instead.
          url: 'http://localhost:8765/healthz',
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
            // Safe defaults so a fresh checkout runs e2e without a local
            // .env.local (which stays untracked because real deployments
            // override these).
            VITE_XMTP_ENV: 'dev',
            VITE_APP_URL: E2E_BASE_URL,
          },
        },
      ],
})
