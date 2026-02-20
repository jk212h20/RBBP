# Active Context

## Current Focus
Telegram new-user notification + telegramUsername field across signup & profile.

## Recent Changes (Feb 20, 2026)
- **Added `telegramUsername` to `UserProfile` model** (migration: `20260220100000_add_telegram_username`)
- **Created `telegram.service.ts`** — wraps CoraTelegramBot, sends "new user joined" alert with name + telegram if provided
- **Auth service `register()`** — now accepts `telegramUsername`, saves to profile, fires Telegram notification
- **Auth validator** — `telegramUsername` optional string, max 50 chars
- **`updateProfileDetails` route/service** — now accepts + persists `telegramUsername`
- **Register page** — optional `@username` field added to signup form
- **Profile page** — Telegram field in "About Me" edit + display sections
- **AuthContext** — `register()` accepts optional `telegramUsername`
- **`api.ts`** — `updateProfileDetails` type updated to include `telegramUsername` + `socialLinks`

## Architecture Overview
See `systemPatterns.md`. Key: Next.js client → Express server → Prisma/PostgreSQL.

## Environment Variables (server)
- `TELEGRAM_BOT_TOKEN` — CoraTelegramBot token
- `TELEGRAM_CHAT_ID` — your chat ID
- `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `VOLTAGE_*`

## Key Patterns
- Profile details (bio, profileImage, telegramUsername, socialLinks) live on `UserProfile` model
- `telegramUsername` stored WITHOUT the `@` prefix
- Telegram notifications fire async (non-blocking) on new email/password registrations
- Google OAuth users do NOT trigger Telegram notification (handled separately if needed)

## What's NOT Built Yet (prioritized)
- Telegram notification on Google OAuth new user registration
- Telegram opt-out / notification preferences
- Admin view of users' telegram usernames
