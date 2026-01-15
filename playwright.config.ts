import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,

  // Comprehensive reporters for error tracking
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./tests/e2e/reporters/error-summary-reporter.ts'],
  ],

  // Global test settings
  expect: {
    timeout: 10000,
  },
  timeout: 60000,

  use: {
    baseURL: 'http://localhost:3000',

    // Comprehensive recording settings
    trace: 'on',                    // Always record traces
    screenshot: 'on',               // Screenshot every test
    video: 'on-first-retry',        // Video on retries

    // Action defaults
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  // Output directory for test artifacts
  outputDir: 'test-results',

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes for Next.js to compile
    stdout: 'pipe',
    stderr: 'pipe',
  },
})