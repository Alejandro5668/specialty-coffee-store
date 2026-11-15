import { expect, test } from '../support/fixtures';

/** Proves which browser and screen each project really ran, so a report cannot overstate it. */
test('runs in the browser and at the screen size its project names', async ({
  page,
  backend,
  browserName,
}, testInfo) => {
  void backend;
  await page.goto('/');
  // The phone project fakes an iPhone user agent, so the engine is told apart by its vendor.
  const vendor = await page.evaluate(() => navigator.vendor);
  expect(browserName === 'firefox' ? vendor === '' : vendor === 'Google Inc.').toBe(true);
  expect(await page.evaluate(() => navigator.userAgent.includes('Firefox/'))).toBe(
    browserName === 'firefox',
  );
  const width = await page.evaluate(() => window.innerWidth);
  if (testInfo.project.name === 'desktop') expect(width).toBeGreaterThan(1000);
  else expect(width).toBe(375);
});
