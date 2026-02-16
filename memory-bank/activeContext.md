# Active Context

## Current Date: 2026-02-15

## Current Focus
Last Longer Pool feature fully implemented with complete UI. Deployed to production.

## Recent Changes (2026-02-15)
- **Last Longer Pool - FULLY COMPLETE** - All UI + backend implemented:
  - DB: `LastLongerEntry` model + 5 fields on `Event` (migration `20260215163000`)
  - Server: `last-longer.service.ts`, 6 routes in `event.routes.ts`
  - Admin: toggle + seed/entry sats config in event create/edit forms
  - Event detail page: full pool section (stats, entries, payment, winner display)
  - **Events list page**: "⚡ Last Longer" badge on event cards when enabled
  - **Homepage**: "⚡ Last Longer" badge on upcoming event cards when enabled
  - Players pay Lightning invoice to enter; admin selects winner; winner credited to balance

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
- Production deployment needs `prisma db push` or migration applied for Last Longer columns
- Local dev verified working after `prisma db push`
