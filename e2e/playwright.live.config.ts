import { defineConfig, devices } from '@playwright/test';

/**
 * Read-only checks against the deployed site. Nothing is bought and no card data is typed:
 * a purchase on a public URL is done by hand with a test card (see README.md).
 * Set E2E_BASE_URL to point at another deployment.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: /live\.spec\.ts/,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://d2eds6bsugsp7t.cloudfront.net',
    locale: 'es-CO',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['iPhone SE'], browserName: 'chromium', channel: 'chrome' },
    },
  ],
});
