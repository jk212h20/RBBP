# Changelog

All notable changes to the Roatan Poker League project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to loose semantic versioning (we're in continuous-deploy mode to Railway).

> **For contributors:** Every PR that changes user-visible behavior should add a bullet under `[Unreleased]`. On release/milestone, entries are moved under a dated heading.

---

## [Unreleased]

### Added
- `CONTRIBUTING.md` — contributor workflow, branching, commit, PR, and agent rules
- `CHANGELOG.md` — this file, seeded from git history
- `docs/DEV_NOTES.md` — running partner-to-partner log of decisions and gotchas
- `.github/PULL_REQUEST_TEMPLATE.md` — PR checklist
- `.github/workflows/ci.yml` — CI that builds client + server on every PR and push to `main`

---

## [2026-07-10] — Phoenix account linking, mobile-first

### Added
- Mobile-first Phoenix account linking flow (`9a0b3f8`)
- Mobile-first one-tap Phoenix payment on all invoices (`f8c7205`)

### Changed
- Events remain listed until results are submitted (previously hid too early) (`ecce359`)
- Side bets: admin reopen action, multi-place payout display (`877d650`)

### Fixed
- Mobile menu scrolling; "Sign Up" hidden when already logged in (`fdbc422`)

---

## [2026-07-01] — Phoenix invoices + UI modernization

### Added
- Phoenix wallet links on all Lightning invoices; live events kept prominent (`6649881`)

### Changed
- Modernized UI and improved page load performance (`7268021`)

---

## [2026-06-30] — Venues + admin store

### Added
- Tagged venue media uploads (`774b0fc`)
- Venue managers can now edit their own venue profiles (`b4b56fe`)
- Admin: load users for venue manager assignment (`4ef78f2`)
- Venue invoice billing (`ca3e59d`)
- Admin store item management (`6d1e8c8`)

### Changed
- Updated site link preview description (Open Graph) (`aee5511`)

---

## [2026-06-26] — iOS/Android Phoenix login

### Changed
- Use Phoenix login links on iOS and Android (`8709052`)
- Force Phoenix LNURL login on iOS (`3529637`)

---

## [2026-06-24] — League points toggle

### Added
- League points toggle and side bet preview safeguards (`3d4de66`)

---

## [2026-06-22] — Admin UX + mobile fixes

### Added
- Admin user panel: searchable, alphabetical by default, with filters (`12ae01c`)
- Homepage hero/CTA, grouped nav menus, venue menu + event rules links (`1ea5039`)
- Mobile QA test suite (`a8c429a`)

### Fixed
- Login copy-code fix (`1ea5039`)
- Mobile layout bugs on profile and store pages (`a8c429a`)

---

## [2026-06-19] — Automatic event side bets

### Added
- Automatic event side bets (`fcf78a2`)

### Fixed
- Attendance points and side bet entry amount (`bbce407`)
- Side bet invoice settlement (`1678618`)

---

## [2026-06-09] — Cashouts + side bet balance source

### Added
- Allow cancelling pending cashouts (`f31430f`)

### Changed
- Simplified cancelled cashout UX (`84d32cb`)
- Side bets now funded from site balance (previously separate flow) (`a4cd5ef`)

### Removed
- Duplicate home page stubs (`6e246f6`)

---

## [2026-05-19] — Shirt store + Lightning checkout

### Added
- Basic shirt store (`6a90952`)
- Lightning checkout for store purchases (`dd298ca`)
- Store item image upload (`48e484d`)

### Changed
- Unified page gradients across the app (`638c825`)

---

## [2026-05-18] — Lightning deposits + event result editing

### Added
- Lightning deposit flow (users can top up site balance) (`415b447`)
- Railway deploy watcher note (`7ac0fc9`)

### Fixed
- Allow editing completed event results (`0dc1f8a`)

---

## [2026-05-12] — Sats buy-ins + blog

### Added
- Buy-in in sats with Lightning + pay-on-arrival flow (`b28cd97`)
- Blog + announcement bar + homepage tweaks (`71a0e1b`)

### Removed
- Unused `Season.pointsStructure` field (`b815993`)

---

## [2026-05-07] — Slugs + registration points toggle

### Added
- Human-readable event URLs (slugs) (`5dc2638`)
- Per-event toggle to disable registration points (`4b3de95`)

### Fixed
- Server: install devDependencies during Railway build (`59ff57b`)

---

## [2026-04-09] — Side Bets: admin tab + multi-entry + descriptions

### Added
- Admin Side Bets tab with full management capabilities (`feat: add admin Side Bets tab with full management`)
- Multiple side bet entries per user — users can enter the same bet more than once (`feat: allow multiple side bet entries per user`)
  - Migration `20260409000000_allow_multiple_side_bet_entries`
- Description field on side bets with 500-char textarea on create page (`feat: add description field to side bets`)
  - Migration `20260402000000_add_side_bet_description`

### Fixed
- Side bets panel on profile page now matches sizing of other panels

---

## [2026-04-01] — User-Created Side Bets System

### Added
- Full user-created side bets feature (`feat: add user-created side bets system`)
  - Prisma models: `SideBet`, `SideBetEntry`, `SideBetSettings`
  - Migration `20260401000000_add_side_bets`
  - Service layer: create, enter, leave, settle, cancel, refund, admin fee config
  - REST API: `/api/side-bets/*` endpoints
  - Client pages: `/bets/create`, `/bets/[id]`
  - Profile and public player pages show each user's active/completed bets
  - Configurable fee pct (default 0%) applied to winner's payout on settlement

---

## [2026-03-20] — Balance Audit Trail

### Added
- Admin balance debit capability with required reason
- Transaction history (`BalanceTransaction` model) — every credit/debit/withdrawal/refund audited
  - Migration `20260320000000_add_balance_transactions`
- Admin UI: per-user transaction drill-down + global filterable/paginated history table

---

## [2026-03-08] — Admin Email Templates + Railway Fix

### Added
- Admin-customizable email templates with `{{variable}}` placeholders
  - Template types: `welcome`, `event_signup`, `event_reminder`, `withdrawal_ready`, `claim_link`
  - `EmailTemplate` model, migration `20260308000000_add_email_templates`
  - Per-template enable/disable, sendRules config (e.g., reminder hours-before), test-send
  - Gracefully degrades when `RESEND_API_KEY` is not set
- New admin "📧 Emails" tab (16th tab)

### Fixed
- Railway CLI linkage: `server/` → service `88b52535`, `client/` → service `2157daaa` (previously both dirs deploying to client service)
- TypeScript errors handling null JSON fields in email template upsert

---

## [2026-02-25] — Check-in Points, Referrals, Points Breakdown

### Added
- **Check-in points:** 1 point per event check-in, with retroactive endpoint for past check-ins
- **Referral system:** 10,000 sat reward (configurable) credited to referrer when referred user checks in at first event
  - Migration `20260225000000_add_referral_system`
  - User-facing referral tab: link, stats, "How It Works"
  - Admin referrals tab with overview, filters, configurable reward settings
- **Points breakdown** on player profile: every point award listed with reason, date, amount
- **Season history** on player profile with `(current)` badge for active season

### Fixed
- Leaderboard now computes accurate total from `PointsHistory` + registration
- Points breakdown now sums correctly
- Event result points now included in player profile breakdown
- `generateClaimLink()` API call corrected to `POST /admin/generate-claim-link` with `{ guestUserId }` body

---

## [2026-02-20] — Telegram Integration

### Added
- `telegramUsername` field on user profile (stored without `@` prefix)
  - Migration `20260220100000_add_telegram_username`
- New-user Telegram notification to admins
- Per-admin `notificationPrefs` (JSON) — each admin toggles their own alerts for newUser / withdrawal / venueApplication
  - Migration `20260220120000_add_notification_prefs`
- Telegram verification flow: users message the bot, server verifies via `/getUpdates`
  - Migration `20260220130000_add_telegram_verified`
- Profile visibility toggles (`PUBLIC` / `ADMIN_ONLY`) for Telegram, Nostr, social links
  - Migrations `20260220140000_add_profile_visibility`, `20260220150000_add_nostr_and_default_private`
- Nostr pubkey field on profile
- Multi-admin notification fan-out (sends to every admin with `telegramVerified=true` and event enabled)
- Notifications fire async (non-blocking)

### Changed
- Default profile visibility for Telegram / Nostr / social links is now `ADMIN_ONLY`
- `notifyAdmins()` only sends to verified admins

---

## [Earlier] — Foundational Features

Condensed summary; see git log and `memory-bank/` for full detail.

### Added
- Daily Puzzle system with queue-based rotation (`sortOrder` + `usedAt`), noon Central rotation, admin drag-ordering
- Last Longer bulk enable button in admin panel
- Venue applications with admin review
- Profile pictures on player avatars, Member Since date fix
- Mobile navigation consistent across dashboard/login/register
- Admin events panel: stable UX, players-who-attended on completed events
- Per-event timezone handling — hardcoded CST for Roatan
- Admin bulk "fix event times" action

### Changed
- View Details buttons: light blue → emerald green
- Events page sort: upcoming first (soonest), completed below (most recent)
- Completed events hide "registered players" section to avoid showing 0-point players

### Fixed
- Puzzle column name mismatch (`sort_order`/`used_at` → camelCase)
- Puzzle admin stats resilient to load failures
- Puzzle routes use `req.user.userId`
- Venue applications crash (renamed `applicant` → `submittedBy` to match API)
- Auto-redirect to venue detail when only 1 venue exists
- Player profile page: correct API URL + response unwrapping
- Last Longer payment detection: use hex hash for LND invoice lookup
- Filter 0-point results from event display
- Next.js 16 standalone build on Railway: `HOSTNAME=0.0.0.0` + static asset copy
- Client build: wrap `useSearchParams` in `<Suspense>` on `/register` page

### Removed
- `profileImage` from server queries (use `avatar` only)

---

## Links

- Repo: https://github.com/jk212h20/RBBP
- Live: https://client-production-41b3.up.railway.app
- Architecture docs: [`memory-bank/systemPatterns.md`](memory-bank/systemPatterns.md)
- Tech setup: [`memory-bank/techContext.md`](memory-bank/techContext.md)
- Active context (session handoff): [`memory-bank/activeContext.md`](memory-bank/activeContext.md)
