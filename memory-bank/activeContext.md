# Active Context

## Current Date: 2026-02-15

## Current Focus
Last Longer Pool feature just implemented and pushed to production. Waiting for Railway deployment to complete.

## Recent Changes (2026-02-15)
- **Last Longer Pool Feature** - Full implementation:
  - DB: New `LastLongerEntry` model + 5 fields on `Event` model (migration `20260215163000`)
  - Server: `last-longer.service.ts`, routes in `event.routes.ts`, validator updates
  - Client: Entry button on event detail page, admin winner selection dropdown
  - Event fields: `lastLongerEnabled`, `lastLongerSeedSats` (default 10000), `lastLongerEntrySats` (default 25000), `lastLongerWinnerId`
  - Players registered for event can pay Lightning invoice to enter pool
  - Admin/TD can select winner from dropdown of pool participants
  - Winner gets total pool (seed + all entries) credited to their lightning balance

## Architecture Overview
- **Client**: Next.js 15 (App Router) on Railway (`roatanbitcoinpoker.com`)
- **Server**: Express + Prisma + PostgreSQL on Railway (`rbbp-production.up.railway.app`)
- **Auth**: Lightning (LNURL-auth) + Google OAuth via Passport.js
- **Payments**: Voltage LND node for Lightning invoices/withdrawals

## Key Files Modified (Last Longer)
- `server/prisma/schema.prisma` - Event model + LastLongerEntry model
- `server/src/services/last-longer.service.ts` - All pool logic
- `server/src/routes/event.routes.ts` - 5 new endpoints under `/events/:id/last-longer/*`
- `server/src/validators/event.validator.ts` - Updated create/update validators
- `server/src/services/event.service.ts` - Include lastLonger fields in queries
- `client/src/app/events/[id]/page.tsx` - Player entry UI + admin winner selection
- `client/src/app/admin/page.tsx` - Last longer toggle + config in event forms
- `client/src/lib/api.ts` - New API functions

## What's NOT Built Yet
- See progress.md for full list
- Season management improvements
- Push notifications
- Chat/messaging

## Environment
- Server: `server/.env` (DATABASE_URL, LND creds, OAuth keys)
- Client: `client/.env.local` (NEXT_PUBLIC_API_URL)

## Known Issues
- Events endpoint returning "Failed to fetch events" on production - likely deployment still in progress
- Need to verify once Railway deployment completes
