import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/merged-junit.xml' }],
    ['json', { outputFile: 'test-results/merged-results.json' }]
  ]
});
