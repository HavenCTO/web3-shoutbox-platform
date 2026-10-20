import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'e2e'],
    // Tests must not depend on CI secrets or a local .env.local. `env.ts`
    // validates at import time, so give unit tests safe defaults.
    env: {
      VITE_XMTP_ENV: 'dev',
      VITE_APP_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
