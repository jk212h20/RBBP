# Active Context

## Current Focus
Admin balance management with credit/debit + transaction audit trail. Email templates and referral system complete.

## Recent Changes (Mar 20, 2026) — Balance Transactions
- **`BalanceTransaction` Prisma model** — audit trail for every Lightning balance change (type: CREDIT/DEBIT/WITHDRAWAL/REFUND, amountSats, note, adminId, balanceAfter)
- **Migration `20260320000000_add_balance_transactions`** — `balance_transactions` table with userId and createdAt indexes
- **`balance.service.ts`** — `creditBalance()` and `debitBalance()` now accept optional `adminId` param and create a `BalanceTransaction` record atomically; added `getUserTransactions()` and `getAllTransactions()` (paginated, filterable)
- **`balance.routes.ts`** — new `POST /api/balance/admin/debit` (reason required), `GET /api/balance/admin/transactions` (paginated, filterable by type), `GET /api/balance/admin/user/:userId/transactions`; credit endpoint now passes adminId
- **`api.ts`** — `balanceAPI.debit()`, `balanceAPI.getTransactions()`, `balanceAPI.getUserTransactions()`
- **`BalanceTab.tsx`** — debit form (red, reason required) alongside credit form (green); user balances list is clickable → per-user transaction drill-down; global transaction history table with type filter and pagination

## Recent Changes (Feb 25, 2026)
### Player Profile — Points Breakdown
- **`auth.service.ts` → `getPublicPlayerProfile()`** — now returns `pointsHistory` (array of `{id, points, reason, date}` from `PointsHistory` table for the active season) and `allSeasons` (array of standings across all seasons with `isActive` flag)
- **`auth.service.ts`** — added `getPlayerPointsHistory()` and `getPlayerAllSeasons()` private helper functions
- **`players/[id]/page.tsx`** — fully rewritten to match actual server response shape (`currentSeasonStanding`, `recentResults`, `pointsHistory`, `allSeasons`); added new sections:
  - **⭐ Points Breakdown** — lists every point award with reason, date, and +/- amount; shows season total at bottom
  - **🏆 Recent Results** — shows event results with ordinal position, knockouts, and points earned (clickable → event page)
  - **📅 Season History** — now shows `(current)` badge on active season

### Referral System + Admin Management
- **Migration `20260225000000_add_referral_system`** — added `referralCode String? @unique`, `referredById String?` (self-relation), `referralRewardPaid Boolean @default(false)` on `User`
- **`referral.service.ts`** — service: `getOrCreateReferralCode()`, `findReferrerByCode()`, `linkReferral()`, `processReferralReward()`, `getReferralStats()`, `validateReferralCode()`, `getAdminReferralOverview()`, `getReferralRewardAmount()`, `setReferralRewardAmount()`
- **Reward: 10,000 sats** (configurable via env `REFERRAL_REWARD_SATS` or admin UI) credited to referrer's Lightning balance when referred user gets checked in at first event
- **`auth.service.ts`** — `registerUser()` accepts optional `referralCode`, validates it, links referral after registration
- **`auth.validator.ts`** — register schema accepts optional `referralCode` string
- **`event.service.ts`** — `checkInPlayer()` calls `processReferralReward()` after successful check-in
- **`auth.routes.ts`** — 3 new endpoints: `GET /api/auth/referral/code`, `GET /api/auth/referral/stats`, `GET /api/auth/referral/validate/:code` (public)
- **`admin.routes.ts`** — 3 new admin endpoints: `GET /api/admin/referrals` (overview), `GET /api/admin/referral-settings`, `PUT /api/admin/referral-settings`
- **`api.ts`** — `referralAPI` object with `getStats()`, `validateCode()`; `adminAPI.getReferralOverview()`, `adminAPI.getReferralSettings()`, `adminAPI.updateReferralSettings()`
- **`AuthContext.tsx`** — `register()` accepts optional `referralCode` param
- **`register/page.tsx`** — reads `?ref=` query param, validates code, shows "Referred by X" banner, passes code to register
- **`ReferralTab.tsx`** — user-facing component: referral link, stats, "How It Works", referral table; **fixed reward display from 1000 to 10000 sats**
- **`AdminReferralsTab.tsx`** — admin component: reward settings (editable), summary stats (total/pending/checked-in/sats paid), filter tabs (all/pending/checked-in/rewarded), expandable referrer list with referral details, color-coded status badges
- **`admin/page.tsx`** — "🔗 Referrals" tab added (15th tab)
- **`profile/page.tsx`** — ReferralTab embedded as "🎯 Referral Program" section between Withdrawal History and Season Points

## Previous Changes (Feb 20, 2026)
### Telegram notification preferences
- **Migration `20260220120000_add_notification_prefs`** — added `notificationPrefs` JSON column on `User` (default: `{"newUser":true,"withdrawal":true,"venueApplication":true}`)
- **`telegram.service.ts` refactored** — now multi-admin fan-out:
  - `notifyAdmins(event, msg)` — queries all ADMIN users with a `telegramUsername` in their profile where `notificationPrefs[event] === true`, sends DM to each
  - Exported helpers: `notifyNewUser()`, `notifyWithdrawalProcessed()`, `notifyVenueApplication()`
- **`withdrawal.service.ts`** — calls `notifyWithdrawalProcessed()` when a withdrawal is marked PAID
- **`venue-application.service.ts`** — calls `notifyVenueApplication()` when an application is submitted
- **`admin.routes.ts`** — GET/PUT `/api/admin/notification-prefs` — each admin reads/writes their own prefs
- **`api.ts`** — `adminAPI.getNotificationPrefs()` and `adminAPI.updateNotificationPrefs()`
- **`NotificationsTab.tsx`** — toggle UI for 3 notification types (newUser, withdrawal, venueApplication)
- **`admin/page.tsx`** — "🔔 Notifications" tab added (13th tab)

### Earlier (same session)
- **`telegramUsername` on `UserProfile`** (migration `20260220100000_add_telegram_username`)
- Auth register + profile update accept `telegramUsername`
- Register page + Profile page have Telegram field

## Architecture Overview
See `systemPatterns.md`. Key: Next.js client → Express server → Prisma/PostgreSQL.

## Recent Changes (Mar 8, 2026) — Email Templates Admin
- **`EmailTemplate` Prisma model** — stores admin-customized email templates in DB (type, subject, body HTML, enabled, sendRules JSON)
- **Migration `20260308000000_add_email_templates`** — `email_templates` table with unique `type` column
- **`email.service.ts`** — completely rewritten with admin template system:
  - 5 template types: `welcome`, `event_signup`, `event_reminder`, `withdrawal_ready`, `claim_link`
  - `{{variable}}` placeholder system with `replaceVariables()` and `{{button:Text:URL}}` shorthand
  - `getTemplate(type)` — loads from DB, falls back to hardcoded defaults
  - `getAllEmailTemplates()`, `updateEmailTemplate()`, `resetEmailTemplate()`, `sendTestEmail()` — admin CRUD
  - Each template has `variableHelp` array for admin UI
  - `sendRules` JSON (e.g., `{ reminderHoursBefore: 24 }` for event_reminder)
  - Gracefully degrades when `RESEND_API_KEY` not set
- **`admin.routes.ts`** — 3 new endpoints: `GET /api/admin/email-templates`, `PUT /api/admin/email-templates/:type`, `POST /api/admin/email-templates/:type/test`
- **`api.ts`** — `adminAPI.getEmailTemplates()`, `adminAPI.updateEmailTemplate()`, `adminAPI.sendTestEmail()`
- **`EmailTemplatesTab.tsx`** — admin UI: edit subject/body per template, enable/disable toggle, send rules config, variable help, test email sender, reset to defaults
- **`admin/page.tsx`** — "📧 Emails" tab added (16th tab)

### Railway Linkage Fix
- Fixed Railway CLI linkage: `server/` → service `88b52535` (RBBP), `client/` → service `2157daaa` (client)
- Previously both dirs were deploying to client service due to stale config

## Environment Variables (server)
- `RESEND_API_KEY` — Resend email API key (optional, emails disabled without it)
- `EMAIL_FROM` — sender address (default: `Roatan Poker <noreply@roatanpoker.com>`)
- `TELEGRAM_BOT_TOKEN` — CoraTelegramBot token
- `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `VOLTAGE_*`
- `TELEGRAM_CHAT_ID` — legacy fallback (no longer primary notification mechanism)

## Key Patterns
- `telegramUsername` stored on `UserProfile` WITHOUT the `@` prefix
- `notificationPrefs` stored as JSON on `User` (not `UserProfile`)
- Telegram notifications fire async (non-blocking)
- Each admin manages their own prefs independently via `/admin/notification-prefs`
- Fan-out: `notifyAdmins('newUser' | 'withdrawal' | 'venueApplication', message)` iterates all admins

### Profile visibility (same session, latest)
- **Migration `20260220140000_add_profile_visibility`** — added `telegramVisibility` and `socialLinksVisibility` (`PUBLIC`/`ADMIN_ONLY` enum, default `PUBLIC`) on `UserProfile`
- **Migration `20260220150000_add_nostr_and_default_private`** — added `nostrPubkey String?` and `nostrVisibility` on `UserProfile`; changed defaults for all three visibility fields to `ADMIN_ONLY`
- **`auth.service.ts`** — `getPublicPlayerProfile()` respects all visibility fields (telegram, nostr, socialLinks); admins see everything
- **`auth.routes.ts`** — `PATCH /api/auth/profile/details` accepts `telegramVisibility`, `nostrPubkey`, `nostrVisibility`, `socialLinksVisibility`
- **`api.ts`** — `updateProfileDetails()` includes all new fields
- **`profile/page.tsx`** — toggle switches (on/off) for Telegram + Nostr visibility; Nostr pubkey input field; view mode shows visibility badges
- **`players/[id]/page.tsx`** — shows `telegramUsername` and `nostrPubkey` on public profiles (omitted by server when `ADMIN_ONLY`)

### Telegram verification flow (same session, later)
- **Migration `20260220130000_add_telegram_verified`** — added `telegramVerified Boolean` on `UserProfile` (default false)
- **`telegram.service.ts`** — `verifyTelegramUsername(username)` — sends `/getUpdates`, finds a `/start` message from user with matching username, marks `telegramVerified=true`
- **`auth.routes.ts`** — `POST /api/auth/telegram/verify` — calls `verifyTelegramUsername` for the authenticated user
- **`auth.service.ts`** — `updateUserProfile()` now resets `telegramVerified=false` when `telegramUsername` changes
- **`api.ts`** — `authAPI.verifyTelegram()`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` env var used in bot links
- **`profile/page.tsx`** — shows ✓ Verified / ⚠️ Not verified badge; unverified users see "Message the Bot → Verify Now" inline widget
- **`NotificationsTab.tsx`** — shows admin's own Telegram status with same verify widget; redirects to profile if no username set
- `notifyAdmins()` now **only** sends to admins where `telegramVerified=true`

## What's NOT Built Yet (prioritized)
- Telegram notification on Google OAuth new user registration
- Admin view of users' telegram usernames in the users table

## Recent Changes (Feb 25, 2026) — Check-in Points
- **`event.service.ts` → `checkInPlayer()`** — now awards 1 point via `pointsService.adjustPoints()` with reason `"Check-in point: {event name}"` on every check-in going forward
- **`admin.routes.ts` → `POST /api/admin/retroactive-checkin-points`** — one-time endpoint to retroactively award 1 point per past check-in; skips duplicates (checks `pointsHistory` by reason string), recalculates ranks after
- **`api.ts` fix** — `generateClaimLink()` now correctly calls `POST /admin/generate-claim-link` with `{ guestUserId }` in body (was incorrectly using `/admin/guest-users/:id/claim-link`)
