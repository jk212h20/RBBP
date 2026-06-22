import { test, expect } from '@playwright/test';
import { PUBLIC_ROUTES } from './routes';
import {
  checkHorizontalOverflow,
  checkTapTargets,
  checkInputFontSizes,
  checkViewportAndPwa,
  checkTinyText,
  checkLayoutSanity,
  stabilize,
} from './heuristics';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'findings');
fs.mkdirSync(OUT_DIR, { recursive: true });

function record(project: string, route: string, data: unknown) {
  const safe = `${project}__${route.replace(/[\/]/g, '_') || 'root'}`.replace(/[^a-z0-9_-]/gi, '_');
  fs.writeFileSync(path.join(OUT_DIR, `${safe}.json`), JSON.stringify(data, null, 2));
}

for (const route of PUBLIC_ROUTES) {
  test.describe(`[${route.name}] ${route.path}`, () => {
    test('mobile usability heuristics', async ({ page }, testInfo) => {
      const project = testInfo.project.name;
      const isMobile = !project.startsWith('desktop');

      const resp = await page.goto(route.path, { waitUntil: 'networkidle' });
      expect(resp, 'navigation response').toBeTruthy();
      expect(resp!.status(), `HTTP status for ${route.path}`).toBeLessThan(400);

      await stabilize(page);

      const overflow = await checkHorizontalOverflow(page);
      const tapTargets = await checkTapTargets(page);
      const inputs = await checkInputFontSizes(page);
      const pwa = await checkViewportAndPwa(page);
      const tinyText = await checkTinyText(page);
      const layout = await checkLayoutSanity(page);

      const findings = { project, route: route.path, isMobile, overflow, tapTargets, inputs, pwa, tinyText, layout };
      record(project, route.path, findings);

      // Attach to the HTML report for inspection.
      await testInfo.attach('findings.json', {
        body: JSON.stringify(findings, null, 2),
        contentType: 'application/json',
      });

      // ---- Hard assertions (fail = real bug) ----
      // No horizontal overflow on mobile viewports.
      if (isMobile) {
        expect(
          overflow.hasHorizontalOverflow,
          `Horizontal overflow on ${route.path}. Offenders: ${JSON.stringify(overflow.offenders.slice(0, 5))}`
        ).toBeFalsy();
      }

      // iOS input-zoom: text inputs must be >=16px.
      expect(
        inputs.tooSmall.length,
        `Inputs <16px (iOS zoom-on-focus) on ${route.path}: ${JSON.stringify(inputs.tooSmall)}`
      ).toBe(0);

      // Viewport meta must exist (Next adds a default; assert anyway).
      expect(pwa.hasViewportMeta, `Missing <meta name=viewport> on ${route.path}`).toBeTruthy();

      // ---- Layout-sanity hard assertions (high-confidence visual bugs) ----
      if (isMobile) {
        expect(
          layout.brokenImages.filter((i) => i.reason === 'failed-to-load').length,
          `Broken images on ${route.path}: ${JSON.stringify(layout.brokenImages)}`
        ).toBe(0);

        expect(
          layout.overlappingTargets.length,
          `Overlapping tap targets on ${route.path}: ${JSON.stringify(layout.overlappingTargets.slice(0, 5))}`
        ).toBe(0);

        expect(
          layout.offScreen.length,
          `Off-screen content on ${route.path}: ${JSON.stringify(layout.offScreen.slice(0, 5))}`
        ).toBe(0);

        // Only ACCIDENTAL clipping (no clamp/ellipsis) is a bug; intentional
        // line-clamp/truncate is a design choice and recorded as informational.
        const accidentalClips = layout.clippedText.filter((c) => c.kind === 'accidental');
        expect(
          accidentalClips.length,
          `Accidentally clipped text on ${route.path}: ${JSON.stringify(accidentalClips.slice(0, 5))}`
        ).toBe(0);
      }
    });
  });
}
