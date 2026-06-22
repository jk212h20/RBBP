import { test, expect } from '@playwright/test';
import { PUBLIC_ROUTES } from './routes';
import { stabilize } from './heuristics';

/**
 * Visual regression: full-page screenshots per route per device.
 * First run writes baselines; subsequent runs diff against them.
 * Run with --update-snapshots to refresh baselines intentionally.
 */
for (const route of PUBLIC_ROUTES) {
  test(`visual [${route.name}] ${route.path}`, async ({ page }, testInfo) => {
    const resp = await page.goto(route.path, { waitUntil: 'networkidle' });
    expect(resp!.status()).toBeLessThan(400);
    await stabilize(page);

    // Mask volatile regions (announcement marquee, anything time-based).
    const masks = [page.locator('[class*="marquee"]')];

    await expect(page).toHaveScreenshot(`${route.name}.png`, {
      fullPage: true,
      animations: 'disabled',
      mask: masks,
      maxDiffPixelRatio: 0.02,
      timeout: 20_000,
    });
  });
}
