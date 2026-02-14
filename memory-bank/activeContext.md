# Active Context — Roatan Poker League

## Last Updated: February 14, 2026

## Current State
The application is **live and deployed on Railway** with all core features functional. The system handles the full poker league lifecycle: venue management, season/event creation, player registration, tournament execution, results entry, standings calculation, and Lightning Network payouts.

## Recent Work (Feb 2026)

### Feb 14 — Total Entrants Dynamic Slots, Logo Fix, Blue Background Site-wide, Venue Applications, Profile Image & Bio, Registration Close Cutoff, Enhanced Event Panels & CSV Exports
- **Total Entrants → Dynamic Extra Player Slots**: When admin/TD sets total entrants higher than attended registered players, blank search-by-typing dropdown slots appear automatically in the TD panel. These slots let the TD assign unregistered players (walk-ins) to the extra positions. Key behaviors:
  - Setting total entrants immediately recalculates the points preview locally (60/30/10 split)
  - Extra slots needed = totalEntrants - attendedRegisteredCount (filled extra slots count toward this total, remaining are blank search fields)
  - Unchecking a registered player's attendance checkbox also creates an extra blank slot (since the total stays the same but attended count drops)
  - Each extra slot has a typeahead search dropdown (reuses `searchPlayers` API) that filters out already-assigned players
  - Filled extra slots show position input + knockout counter, same as registered players
  - All extra slot players are included in save/finalize results alongside registered attended players
  - Server `enterResults` already uses `totalEntrants` override for points calculation
- **Logo Transparency Fix**: Reprocessed `client/public/logo.png` with aggressive edge cleanup (flood-fill + 3-pass erosion + post-downscale fringe removal) to eliminate white pixel artifacts around edges. Result: 139K transparent pixels, only 3.4K semi-transparent (vs backup's 7.7K). `logo_backup.png` kept as reference.
- **Blue Gradient Background Site-wide**: Applied blue gradient (`#3d7a94` → `#5595b0` → `#2a5f78`) to `globals.css` body so ALL pages have the blue background (previously only homepage had it inline). Removed dark mode override. Set white foreground text. Removed all per-page `bg-gradient-to-br from-green-900 via-green-800 to-black` classes from 11 page files. Converted ALL green Tailwind accent colors (borders, text, bg, hover, focus, placeholder, divide) to blue equivalents across all .tsx files — zero green references remain in the codebase.
- **Venue Application System**: Any logged-in user can apply to add their venue to the platform
  - `VenueApplication` model: name, address, description, contactName, contactEmail, contactPhone, status (PENDING/APPROVED/REJECTED), adminNotes, applicantId, venueId (set on approval)
  - Backend: `venue-application.routes.ts` with 4 endpoints:
    - `POST /venue-applications` — submit application (auth required)
    - `GET /venue-applications` — admin: list all applications
    - `PUT /venue-applications/:id/approve` — admin: approve (creates venue automatically)
    - `PUT /venue-applications/:id/reject` — admin: reject with optional notes
  - Service: `venue-application.service.ts` with create, getAll, approve (creates venue + links), reject
  - Client API: `venueApplicationsAPI.submit()`, `.getAll()`, `.approve()`, `.reject()`
  - Frontend: `/venues/apply` — application form page with all fields
  - Frontend: "Apply to Add Your Venue" button on venues page
  - Admin: `VenueApplicationsTab` component in admin panel (🏢 Applications tab)
  - Migration: `20260214170000_add_venue_applications`
- **Profile Image & Bio**: Users can upload a profile photo and write a personal bio on their profile page
  - `profileImage` (Text, nullable) and `bio` (String, 500 char max) fields added to Profile model
  - Backend: `GET /auth/profile/details` and `PUT /auth/profile/details` routes
  - Service: `getProfileDetails()` and `updateProfileDetails()` in auth.service.ts
  - Client API: `authAPI.getProfileDetails()` and `authAPI.updateProfileDetails()`
  - Frontend: "About Me" card on profile page with inline edit mode, circular avatar upload with center-crop compression, textarea for bio with character counter
  - Migration: `20260214160000_add_profile_image`
- **Enhanced Upcoming Events Panels** (homepage + /events page):
  - Venue address displayed below venue name
  - Thumbnail image shown if event has imageUrl
  - Larger font (text-xl/text-2xl) for player count (e.g., "👥 0/20")
  - Live countdown timer to event start (updates every 60s)
  - Treasure chest SVG icon with possible points badge (calculated: 10 + 2 per player over 10)
  - Server `getUpcomingEvents` now includes `venue.address` in select
  - `calculateEventPoints` exported from event.service.ts, mirrored client-side as `calculatePossiblePoints`
- **Registration Close Minutes**: New `registrationCloseMinutes` field on Event model (default 30)
  - Non-admin players cannot register/unregister after `event.dateTime - registrationCloseMinutes`
  - Admins can always register/unregister players regardless of cutoff
  - Server-side enforcement in signup/cancel routes with 403 error
  - Client: "🔒 Registration closed" banner on event detail page when cutoff passed
  - Admin: "Reg Closes (min before)" field in single event creation form
  - Validator: `registrationCloseMinutes` optional int (0-1440) in create/update schemas
  - Migration: `20260214152400_add_registration_close_minutes`

### Feb 11 — Homepage Redesign, Logo, TD Panel Fix, Total Entrants Override, FAQ & Deployment Fix
- **Homepage Logo & Blue Theme**: Processed `Logo.png` (4096x4096) → `client/public/logo.png` (512x512, clean 8x downscale via LANCZOS) with transparent background (flood-fill from edges). Displayed at 300x300 in hero section to the left of "Welcome to RBBP" title. Small 28x28 logo in MobileNav header. Changed homepage background from green gradient to blue gradient (`#3d7a94` → `#5595b0` → `#2a5f78`) matching the sky blue inside the logo's ship wheel.
- **TD Panel Default Open**: Changed `showManagement` initial state to `true` so Quick Add Player and other TD tools are visible immediately when visiting an event page (was defaulting to collapsed/hidden)
- **Total Entrants Override**: New feature allowing TDs to override the player count used for points calculation
  - `totalEntrants` nullable Int field on Event model
  - Backend: `PUT /events/:id/total-entrants` route + `setTotalEntrants` service method
  - Frontend: Number input in TD Panel with Set/Clear buttons
  - Client API: `eventsAPI.setTotalEntrants(eventId, value)`
  - Migration: `20260211190000_add_total_entrants`
- **FAQ System**: Public FAQ page + admin CRUD management
  - `Faq` model: question, answer, sortOrder, isActive
  - Backend: `GET /faq` (public, active only), `GET /faq/admin` (all), `POST /faq`, `PUT /faq/:id`, `DELETE /faq/:id`
  - Frontend: `/faq` public page with accordion UI, `FaqTab` component in admin panel
  - Client API: `faqAPI.getAll()`, `faqAPI.getAllAdmin()`, `faqAPI.create()`, `faqAPI.update()`, `faqAPI.delete()`
  - MobileNav: FAQ link added to navigation
  - Migration: `20260211200000_add_faq`
- **Deployment Resilience**: Moved `prisma migrate deploy` from start command to build phase in both `railway.toml` and `nixpacks.toml`. Start command is now just `npm start` for instant server startup. Migrations run during build where there's no health check timeout pressure. This prevents failed health checks from blocking deployments.

### Feb 10 — Withdrawal History UI, Quick Add Players, Guest Merge & Claim Links
- **Withdrawal History**: Added user-facing withdrawal history section to profile page
  - Calls `withdrawalsAPI.getMy()` to fetch user's past withdrawals
  - Shows amount, date, and color-coded status badges (PAID/PENDING/CLAIMED/EXPIRED/FAILED)
  - Auto-refreshes after successful withdrawal completion
- **Guest Users**: `isGuest` flag on User model for walk-ins without accounts
- **Player Search**: TD can search existing users by name from event page
- **Quick Add**: TD can add existing users or create guest accounts on the fly
- **Frontend UI**: Search/Guest toggle in TD Panel with typeahead search dropdown
- **Guest Merge**: Admin can merge guest accounts into real user accounts (transfers results, standings, signups)
- **Guest Label**: Leaderboard shows "(guest)" badge next to guest player names
- **Claim Links**: Admin generates a unique URL for a guest; guest visits `/claim/[token]` to set email+password and convert to real account
  - `claimToken` + `claimTokenExpiry` fields on User model
  - Backend: `POST /admin/generate-claim-link`, `GET /auth/claim/:token` (validate), `POST /auth/claim/:token` (claim)
  - Frontend: `/claim/[token]` page, "Generate Claim Link" button in admin guest merge section with copy-to-clipboard
  - Migration: `20260210180000_add_claim_token`
- Backend: `GET /events/:id/search-players`, `POST /events/:id/quick-add`, `POST /admin/merge-guest`, `GET /admin/guest-users`
- Migration: `20260210170000_add_guest_flag`
- Feature doc: `memory-bank/features/quick-add-players.md`

### Feb 5 — Registration Open Days
- Added `registrationOpenDays` field to events (default: 10 days before event)
- Events auto-open for registration based on this window
- Migration: `20260205162200_add_registration_open_days`

### Feb 4 — Points System & User Management
- **Points History**: Full audit trail for all point changes (PointsHistory model)
- **Manual Point Adjustments**: Admin can award/deduct points with reasons
- **Bulk Point Awards**: Award points to multiple users at once
- **Admin Notes**: Hidden notes field on users for admin use
- **Deleted Users**: Soft-delete with full data snapshot (DeletedUser model)
- **Waitlist System**: Auto-promotion when spots open, configurable max players
- **Points Tab**: Admin UI component for managing points
- Migrations: `20260204181000`, `20260204190000`, `20260204200000`

### Feb 2 — Lightning & Withdrawals
- **Event Images**: Base64 image upload for events (ImageUpload component)
- **Withdrawal System**: Full LNURL-withdraw flow (create → QR → scan → pay)
- **Lightning Balance**: Per-user sat balance tracking with credit/debit/set operations
- **Voltage Integration**: LND REST API for node info, channel balance, invoice decode/pay
- **Balance Tab & Withdrawals Tab**: Admin UI components
- Migrations: `20260202201500`, `20260202210800`, `20260202230100`

### Feb 1 — Foundation
- **Name Set At**: Track when users set their display name
- Migration: `20260201220000`

## Architecture Overview

### Client (Next.js 16 / React 19)
```
client/src/
├── app/                    # Next.js App Router pages
│   ├── page.tsx            # Home — upcoming events, leaderboard preview
│   ├── login/              # Email/password + Lightning login
│   ├── register/           # New account registration
│   ├── dashboard/          # Player dashboard (my events, standings)
│   ├── events/             # Event list + detail pages
│   ├── leaderboard/        # Season standings
│   ├── profile/            # User profile management
│   ├── admin/              # Multi-tab admin panel (incl. FAQ tab)
│   ├── faq/                # Public FAQ page
│   ├── venues/             # Venue list + detail + apply pages
│   └── auth/callback/      # Google OAuth callback handler
├── components/
│   ├── MobileNav.tsx       # Mobile hamburger navigation
│   ├── ImageUpload.tsx     # Base64 image upload component
│   ├── BalanceTab.tsx      # Admin: Lightning balance management
│   ├── WithdrawalsTab.tsx  # Admin: Withdrawal management
│   ├── PointsTab.tsx       # Admin: Points adjustment UI
│   ├── FaqTab.tsx          # Admin: FAQ management UI
│   ├── VenueApplicationsTab.tsx  # Admin: Venue application review
│   └── ExportsTab.tsx      # Admin: CSV data export (users, events, leaderboard, etc.)
├── context/
│   └── AuthContext.tsx      # React Context for auth state + JWT
└── lib/
    └── api.ts              # Centralized API client (fetchAPI wrapper)
```

### Server (Express.js + TypeScript)
```
server/src/
├── index.ts                # Express app setup, route mounting, CORS
├── config/passport.ts      # Passport strategies (Google, Lightning)
├── middleware/auth.middleware.ts  # JWT verification, role checks
├── routes/                 # 11 route files (auth, venue, venue-application, season, event, standings, admin, withdrawal, lnurl, balance, faq)
├── services/               # 11 service files (business logic layer)
├── validators/             # 4 Zod validation schemas
├── types/express.d.ts      # Express type augmentation
└── lib/prisma.ts           # Prisma client singleton
```

### Database (Prisma / PostgreSQL)
17 models: User, Profile, Venue, Season, Event, EventSignup, Result, Standing, Achievement, UserAchievement, LightningChallenge, Comment, DeletedUser, Withdrawal, PointsHistory, Faq, VenueApplication

## Key Patterns & Decisions

1. **Service Layer Pattern**: All business logic in service files, routes are thin controllers
2. **JWT Auth**: 7-day tokens, stored client-side, sent as Bearer header
3. **Role-Based Access**: `requireAuth`, `requireAdmin`, `requireRole` middleware
4. **Dynamic Points**: Points pool scales with player count (not fixed)
5. **Event Status Flow**: DRAFT → REGISTRATION_OPEN → IN_PROGRESS → COMPLETED / CANCELLED
6. **Waitlist**: When event is full, new signups go to waitlist; cancellations auto-promote
7. **Lightning Auth**: LNURL-auth with in-memory challenge store (LightningChallenge model)
8. **Lightning Withdrawals**: LNURL-withdraw protocol via Voltage LND node
9. **Soft Deletes**: Users are archived to DeletedUser, not hard-deleted

## What's NOT Built Yet

### High Priority
- **Google OAuth**: UI exists but needs Google Cloud credentials configured
- **Email Notifications**: Nodemailer/SendGrid dependency installed, no notification service built
- **Achievement/Badge Display**: Schema exists (Achievement, UserAchievement), no UI or awarding logic
- **Event Comments**: Schema exists (Comment model), no routes or UI

### Medium Priority
- **Redis Session Store**: Currently using MemoryStore (fine for single-instance Railway)
- **Player Statistics Page**: Detailed per-player stats beyond standings
- **Event History/Archive**: Past events browsing with filters
- **Password Reset Flow**: No forgot-password email flow

### Low Priority / Nice-to-Have
- **Real-time Updates**: WebSocket for live event updates
- **Push Notifications**: Mobile push for event reminders
- ~~**Export/Reports**: CSV export of standings, results~~ ✅ Built (Exports tab in admin panel)
- **Multi-language Support**: Spanish for local Roatan audience

## Environment Variables (Server)
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `SESSION_SECRET` | ✅ | Secret for express-session |
| `CLIENT_URL` | ✅ | Frontend URL for CORS |
| `PORT` | ❌ | Server port (default: 3001) |
| `NODE_ENV` | ❌ | Environment (development/production) |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ❌ | Google OAuth secret |
| `GOOGLE_CALLBACK_URL` | ❌ | Google OAuth callback URL |
| `LIGHTNING_AUTH_URL` | ❌ | Base URL for Lightning auth endpoints |
| `VOLTAGE_REST_HOST` | ❌ | Voltage LND node REST URL |
| `VOLTAGE_MACAROON` | ❌ | Voltage admin macaroon (hex) |
| `LNURL_BASE_URL` | ❌ | Public API URL for LNURL callbacks |
| `SENDGRID_API_KEY` | ❌ | SendGrid API key (not yet used) |

## Environment Variables (Client)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL (e.g., https://rbbp-production.up.railway.app/api) |
