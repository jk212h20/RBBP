# RBBP Mobile QA Suite

Automated visual + usability testing for **rbbp.fun**, focused on mobile.

## What it tests

| Spec | Purpose |
|---|---|
| `tests/usability.spec.ts` | Per-route heuristics on every device: horizontal overflow, tap-target size, iOS input-zoom (font <16px), tiny text, viewport/PWA readiness. **Fails** on overflow + input-zoom. |
| `tests/visual.spec.ts` | Full-page screenshot regression per route per device. Baselines committed under `tests/visual.spec.ts-snapshots/`. |
| `tests/auth-flows.spec.ts` | Same heuristics on authenticated pages (`/dashboard`, `/profile`). |
| `tests/a11y.spec.ts` | axe-core WCAG 2 A/AA scan (informational). |

## Devices / engines

- **WebKit** (iPhone SE 320/375, iPhone 14 390, iPhone 14 Pro Max 430) — same engine as iOS Safari; closest faithful approximation without Apple hardware.
- **Chromium** (Pixel 7 412) — Android Chrome.
- **Desktop Chrome** (1280) — baseline.

> ⚠️ WebKit ≈ Safari but is **not** a real iPhone. It will not reproduce iOS Safari's dynamic toolbar (`100vh`) resize, true notch safe-area, or device font rendering. For those, code-level checks are used (viewport-fit, input font-size). True iOS verification needs a real-device cloud (BrowserStack/LambdaTest).

## Auth

`tests/auth.setup.ts` logs the disposable QA account in via the live API and injects the `token` into localStorage (`storageState`). Credentials come from `/tmp/rbbp-qa/creds.json` or env `QA_EMAIL`/`QA_PASSWORD`/`QA_API_BASE`.

## Run

```bash
npm install
npx playwright install chromium webkit firefox

# everything
npx playwright test

# just usability (read-only, fast)
npx playwright test usability.spec.ts auth-flows.spec.ts

# refresh visual baselines after intentional UI changes
npx playwright test visual.spec.ts --update-snapshots

# accessibility
npx playwright test a11y.spec.ts --project=iphone-14-webkit

# human-readable rollup
node summarize.mjs   # writes FINDINGS.md

# open the rich HTML report (screenshots, traces, attachments)
npx playwright show-report report
```

## Output

- `FINDINGS.md` — rollup of all heuristic + a11y results.
- `findings/*.json` — raw per-route/per-device data.
- `report/` — Playwright HTML report.
- `tests/visual.spec.ts-snapshots/` — screenshot baselines.
