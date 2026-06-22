import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PUBLIC_ROUTES } from './routes';
import { stabilize } from './heuristics';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'findings', 'a11y');
fs.mkdirSync(OUT, { recursive: true });

// Run a11y only on mobile WebKit (Safari engine) — one representative device
// keeps runtime down while covering the priority surface.
test.describe('accessibility (axe-core)', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`a11y [${route.name}] ${route.path}`, async ({ page }, testInfo) => {
      test.skip(!testInfo.project.name.includes('iphone-14-webkit'), 'one device only');
      await page.goto(route.path, { waitUntil: 'networkidle' });
      await stabilize(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      const summary = results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
      }));
      fs.writeFileSync(
        path.join(OUT, `${route.name}.json`),
        JSON.stringify({ route: route.path, violations: summary }, null, 2)
      );
      await testInfo.attach('a11y.json', {
        body: JSON.stringify(summary, null, 2),
        contentType: 'application/json',
      });
      // Informational: don't fail the build on a11y, just record.
    });
  }
});
