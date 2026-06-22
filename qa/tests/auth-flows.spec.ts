import { test, expect } from '@playwright/test';
import { AUTH_ROUTES } from './routes';
import {
  checkHorizontalOverflow,
  checkInputFontSizes,
  checkTapTargets,
  stabilize,
} from './heuristics';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'findings');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Reuse the authenticated storage state produced by auth.setup.ts.
test.use({ storageState: path.join(process.cwd(), '.auth', 'state.json') });

for (const route of AUTH_ROUTES) {
  test(`auth usability [${route.name}] ${route.path}`, async ({ page }, testInfo) => {
    const project = testInfo.project.name;
    const isMobile = !project.startsWith('desktop');

    const resp = await page.goto(route.path, { waitUntil: 'networkidle' });
    expect(resp!.status()).toBeLessThan(400);

    // Confirm we are NOT bounced to /login (i.e., auth worked).
    await page.waitForTimeout(800);
    expect(page.url(), `Expected to stay on ${route.path}, got ${page.url()}`).not.toContain('/login');

    await stabilize(page);

    const overflow = await checkHorizontalOverflow(page);
    const inputs = await checkInputFontSizes(page);
    const tap = await checkTapTargets(page);

    const findings = { project, route: route.path, overflow, inputs, tapTargets: tap };
    const safe = `${project}__auth_${route.name}`.replace(/[^a-z0-9_-]/gi, '_');
    fs.writeFileSync(path.join(OUT_DIR, `${safe}.json`), JSON.stringify(findings, null, 2));
    await testInfo.attach('findings.json', { body: JSON.stringify(findings, null, 2), contentType: 'application/json' });

    if (isMobile) {
      expect(
        overflow.hasHorizontalOverflow,
        `Horizontal overflow on ${route.path}: ${JSON.stringify(overflow.offenders.slice(0, 5))}`
      ).toBeFalsy();
    }
    expect(
      inputs.tooSmall.length,
      `Inputs <16px on ${route.path}: ${JSON.stringify(inputs.tooSmall)}`
    ).toBe(0);
  });
}
