import 'dotenv/config';

import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  timeout: 120000,
  expect: {
    timeout: 120000
  },
  testDir: './__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  maxFailures: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter:
    process.env.PLAYWRIGHT_REPORTER === 'blob'
      ? [['blob']]
      : [
          ['html', { open: 'never' }],
          ['junit', { outputFile: 'test-results/junit.xml' }],
          ['json', { outputFile: 'test-results/results.json' }]
        ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-first-failure',
    actionTimeout: 60000
  },
  projects: [
    {
      name: 'smoke',
      grep: /@smoke/,
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'flows',
      grep: /@flows/,
      use: {
        ...devices['Desktop Chrome']
      }
    },
    {
      name: 'security',
      grep: /@security/,
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI
  }
});
