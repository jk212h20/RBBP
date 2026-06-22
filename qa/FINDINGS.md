# Mobile Usability Findings — rbbp.fun

Generated: 2026-06-22T20:08:15.497Z

Devices tested per route: WebKit (iPhone SE/14/14 Pro Max — Safari engine), Chromium (Pixel 7), Desktop.

## Site-wide PWA / "Add to Home Screen" readiness

- Viewport meta present: ✅ (`width=device-width, initial-scale=1`)
- viewport-fit=cover (notch safe-area): ❌
- theme-color: ❌
- Web App Manifest: ❌
- apple-touch-icon (iOS home-screen icon): ❌
- apple/mobile-web-app-capable: ❌

## Per-route summary (mobile viewports)

| Route | Overflow? | Tap <40px | Inputs <16px | Tiny text | Edge-touch | Overlap | Broken img | Clipped | Off-screen |
|---|---|---|---|---|---|---|---|---|---|
| `/` | ok | 3 | - | - | - | - | - | - | - |
| `/blog` | ok | 1 | - | - | - | - | - | - | - |
| `/dashboard` | ok | 2 | - | - | - | - | - | - | - |
| `/events` | ok | 19 | - | - | - | - | - | 15 (by design) | - |
| `/faq` | ok | 1 | - | - | - | - | - | - | - |
| `/leaderboard` | ok | 32 | - | - | - | - | - | - | - |
| `/login` | ok | 5 | - | - | - | - | - | - | - |
| `/profile` | ⚠️ YES | 13 | ⚠️ 1 | - | - | - | - | - | - |
| `/puzzle` | ok | 1 | - | - | - | - | - | - | - |
| `/register` | ok | 2 | - | - | - | - | - | - | - |
| `/store` | ⚠️ YES | 1 | - | - | 14 | - | - | - | - |
| `/venues` | ok | 1 | - | - | - | - | - | 5 (by design) | - |
| `/venues/apply` | ok | 5 | - | - | - | - | - | - | - |

## Detailed issues

### Overflow on `/profile`
Viewport 320px, document 340px.
Offenders:
- `button.px-4.py-2` right=340 w=67 "Copy"

### Inputs <16px on `/profile` (iOS zoom-on-focus)
- `input` font-size=14px type=text

### Overflow on `/store`
Viewport 320px, document 354px.
Offenders:
- `section.bg-white/10.backdrop-blur` right=354 w=338 "Roatan Bitcoin Bar Poker Shirt Season O"
- `aside.bg-gray-950/70.backdrop-blur` right=354 w=338 "Choose your shirt Size Small 9 left Medi"
- `div.aspect-video.bg-black/20` right=329 w=288 ""
- `div.flex.flex-col` right=329 w=288 "Roatan Bitcoin Bar Poker Shirt Season O"
- `div` right=329 w=288 "Roatan Bitcoin Bar Poker Shirt Season O"
- `h2.text-3xl.font-bold` right=329 w=288 "Roatan Bitcoin Bar Poker Shirt"

## Accessibility (axe-core, WCAG 2 A/AA) — iPhone 14 / WebKit

| Route | Violations | Rule IDs |
|---|---|---|
| `/blog` | 0 | — |
| `/events` | 2 | color-contrast, select-name |
| `/faq` | 0 | — |
| `/` | 0 | — |
| `/leaderboard` | 1 | select-name |
| `/login` | 1 | color-contrast |
| `/puzzle` | 0 | — |
| `/register` | 1 | color-contrast |
| `/store` | 0 | — |
| `/venues/apply` | 1 | color-contrast |
| `/venues` | 1 | color-contrast |
