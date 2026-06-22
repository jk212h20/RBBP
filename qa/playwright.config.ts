import { defineConfig, devices } from '@playwright/test';

/**
 * QA harness for rbbp.fun (live).
 *
 * Runs against the production site. Read-only by default: the heuristic/visual
 * checks only navigate and inspect; no data is created except via the explicit
 * authenticated flows we opt into (and only with the disposable QA account).
 *
 * Engines:
 *  - WebKit  -> closest faithful approximation of iOS Safari (same engine).
 *  - Chromium -> Android Chrome behaviour.
 *  - Firefox -> cross-engine sanity.
 */
const BASE_URL = process.env.QA_BASE_URL || 'https://www.rbbp.fun';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'report', open: 'never' }],
    ['json', { outputFile: 'report/results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Stabilise screenshots: stop animations/caret/marquee.
    reducedMotion: 'reduce',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    // Auth setup: logs in QA account, writes storageState. Other projects that
    // need auth depend on this; usability/visual public specs do not.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // ---- Mobile (the priority) ----
    {
      name: 'iphone-se-webkit',
      use: { ...devices['iPhone SE'] }, // 375x667, WebKit
      dependencies: ['setup'],
    },
    {
      name: 'iphone-14-webkit',
      use: { ...devices['iPhone 14'] }, // 390x664, WebKit
      dependencies: ['setup'],
    },
    {
      name: 'iphone-14-pro-max-webkit',
      use: { ...devices['iPhone 14 Pro Max'] }, // 430x739, WebKit
      dependencies: ['setup'],
    },
    {
      name: 'pixel-7-chromium',
      use: { ...devices['Pixel 7'] }, // 412x..., Chromium
      dependencies: ['setup'],
    },
    // ---- Desktop baseline ----
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      dependencies: ['setup'],
    },
  ],
});
