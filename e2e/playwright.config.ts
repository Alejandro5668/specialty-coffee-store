import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

/**
 * Local suite: the real frontend (Vite dev server) against a simulated API and payment service,
 * so every case is deterministic and nothing reaches the real provider.
 * Uses the Chrome installed on the machine: no browser download.
 * Traces, videos and screenshots stay off because the forms hold (test) card data.
 */
export default defineConfig({
  testDir: './tests',
  testIgnore: /live\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // A result arrives after the page polls the order, which takes longer on a loaded machine.
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-CO',
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  projects: [
    {
      // iPhone SE (2020): 750 x 1334 px at 2x, the smallest screen the test names.
      name: 'mobile',
      use: {
        ...devices['iPhone SE'],
        browserName: 'chromium',
        channel: 'chrome',
        defaultBrowserType: 'chromium',
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: `npm run dev -w frontend -- --port ${PORT} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_PAYMENT_API_URL: 'https://payments.test/v1',
      VITE_PAYMENT_PUBLIC_KEY: 'pub_test_e2e',
    },
  },
});
