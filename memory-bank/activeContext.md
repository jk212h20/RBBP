# Active Context

## Current Date: 2026-02-19

## Current Focus
Timezone fix (all times in Roatan/CST), event editing in admin panel.

## ⚠️ IMPORTANT: Timezone Rule
**All event times are in Roatan time (America/Tegucigalpa, CST/UTC-6).** The server stores dates in UTC but creates/displays them assuming Roatan local time. The `createBulkEvents()` function in `event.service.ts` explicitly constructs dates in CST (UTC-6). When creating events, the `time` field (e.g., "19:00") is interpreted as Roatan time. This must NEVER be changed.

## Recent Changes (2026-02-19 - Timezone Fix & Event Editing)
- **Bug found**: Bulk event creation was using `getTimezoneOffset()` which returns the SERVER's timezone offset, not Roatan's. When the server runs in a different timezone (e.g., UTC on Railway), events got the wrong time.
- **Fix**: Hardcoded CST offset (UTC-6) in `event.service.ts` `createBulkEvents()` instead of using `getTimezoneOffset()`
- **Admin fix-event-times endpoint**: Added `POST /api/admin/fix-event-times` in `admin.routes.ts` — bulk-fixes all future events to 7pm CST (01:00 UTC next day)
- **Admin UI**: Added "Fix Event Times (7pm CST)" button in Events tab of admin page
- **Event edit modal**: Added inline edit functionality in admin Events tab — click ✏️ on any event to edit name, date/time, venue, max players, buy-in, description
- **Server**: PUT `/api/events/:id` route already existed; client `eventsAPI.update()` added to `api.ts`

## Recent Changes (2026-02-18 - Desktop Logout Button)
- **Bug fix**: Desktop navigation had no Logout button — only mobile hamburger menu had one
- **Fix**: Added dropdown user menu to desktop nav in `MobileNav.tsx` — clicking user's name shows dropdown with Dashboard, Profile, Admin (if admin), and Logout
- **Dropdown**: Uses `useRef` + click-outside listener to auto-close; styled with dark bg matching site theme

## Recent Changes (2026-02-18 - Player Profiles & Nav)
- **Public Player Profile Page** (`/players/[id]`) - New page showing player stats, bio, social links, event history
- **Server: Player profile endpoint** - `GET /api/players/:id/profile` returns user info + profile + standings + events
- **Server: Social links** - `updateProfileDetails` accepts `socialLinks` JSON; `getProfileDetails` returns it
- **Leaderboard** - Profile pics (avatars) shown next to names; names are links to `/players/[id]`
- **Event detail page** - Player names in registrations/results are links to `/players/[id]` with profile pics
- **Profile page** - New "Social Links" card (Instagram, X/Twitter, Facebook, Hendon Mob, Website) with edit UI
- **Profile page** - Uses MobileNav instead of custom header
- **Navigation consistency** - All pages now use MobileNav component:
  - Events list, Event detail, Leaderboard, Venues list, Venue detail, FAQ, Dashboard, Profile, Player profile, Login, Register
- **Dashboard** - Replaced custom minimal nav with full MobileNav component
- **Login/Register** - Added MobileNav for consistent navigation across all pages
- **Avatars** - Leaderboard and event detail pages use Google avatar URLs directly (not profileImage upload)
- **Client API** - Added `playersAPI.getProfile(id)` to `api.ts`

## Recent Changes (2026-02-18 - Events Ordering)
- **Events page sorting** - Upcoming events now appear first (soonest first), completed events below (most recent first)
- **Section headers** - Events page split into "📅 Upcoming Events" and "✅ Completed Events" sections with count badges
- **Client-side sort** - Sorting done in `client/src/app/events/page.tsx` using `isUpcoming()` check (future date + not COMPLETED status)

## Recent Changes (2026-02-18 - Earlier)
- **Events list page** - Added small venue image thumbnail + venue address as Google Maps link on event cards
- **Individual Event page** - Venue image now shows; address is a Google Maps link
- **Venues list page** - Each venue card now links to `/venues/[id]` individual page; shows venue image
- **Individual Venue page** - Address is now a Google Maps link (opens in new tab)

## Architecture Overview
- **Client**: Next.js 15 (App Router) on Railway (`roatanbitcoinpoker.com`)
- **Server**: Express + Prisma + PostgreSQL on Railway (`rbbp-production.up.railway.app`)
- **Auth**: Lightning (LNURL-auth) + Google OAuth via Passport.js
- **Payments**: Voltage LND node for Lightning invoices/withdrawals

## Key Files Modified (Player Profiles)
- `server/src/services/auth.service.ts` - `getPublicPlayerProfile()`, social links in profile details
- `server/src/routes/auth.routes.ts` - `GET /players/:id/profile` route
- `server/src/services/standings.service.ts` - Include `user.profile.profileImage` in standings
- `server/src/services/event.service.ts` - Include `user.profile.profileImage` in signups/results
- `client/src/app/players/[id]/page.tsx` - New public player profile page
- `client/src/app/leaderboard/page.tsx` - Profile pics + name links
- `client/src/app/events/[id]/page.tsx` - Profile pics + name links + MobileNav
- `client/src/app/profile/page.tsx` - Social links card + MobileNav
- `client/src/app/venues/[id]/page.tsx` - MobileNav replaces custom header
- `client/src/lib/api.ts` - `playersAPI.getProfile()`

## What's NOT Built Yet
- See progress.md for full list
- Season management improvements
- Push notifications
- Chat/messaging

## Environment
- Server: `server/.env` (DATABASE_URL, LND creds, OAuth keys)
- Client: `client/.env.local` (NEXT_PUBLIC_API_URL)

## Recent Changes (2026-02-18 - Last Longer Payment Fix)
- **Bug fix**: `lookupInvoice()` in `voltage.service.ts` was passing base64url-encoded payment hash to LND REST API `/v1/invoice/{r_hash_str}`, but this endpoint expects **hex-encoded** hash. Invoice lookups were failing silently, so payment polling never detected paid invoices.
- **Fix**: Changed `lookupInvoice()` to pass hex hash directly instead of converting to base64url
- **Added logging**: `last-longer.service.ts` now logs payment check attempts and results for debugging

## Known Issues
- Production deployment needs `prisma db push` or migration applied for Last Longer columns
- Social links stored as JSON in Profile.socialLinks field
