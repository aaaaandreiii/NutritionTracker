import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  // Screenshot-heavy responsive cases contend for the same local preview process on CI/macOS.
  // Keep this small research suite serial so route mocks and full-page captures stay deterministic.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: existsSync(macChrome) ? { executablePath: macChrome } : undefined,
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
