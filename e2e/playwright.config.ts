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
      // iPhone SE (2020): 750 x 1334 px at 2x, which is 375 x 667 css px, the screen the test names.
      // Playwright's plain "iPhone SE" is the 2016 model (320 x 568), so the 3rd gen entry is used.
      name: 'mobile',
      use: {
        ...devices['iPhone SE (3rd gen)'],
        browserName: 'chromium',
        channel: 'chrome',
        defaultBrowserType: 'chromium',
      },
    },
    {
      // Firefox cannot emulate a phone, so it gets the same screen size and touch input.
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 375, height: 667 },
        deviceScaleFactor: 2,
        hasTouch: true,
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
