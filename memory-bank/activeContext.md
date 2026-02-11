# Active Context — Roatan Poker League

## Last Updated: February 11, 2026

## Current State
The application is **live and deployed on Railway** with all core features functional. The system handles the full poker league lifecycle: venue management, season/event creation, player registration, tournament execution, results entry, standings calculation, and Lightning Network payouts.

## Recent Work (Feb 2026)

### Feb 11 — TD Panel Visibility Fix & Total Entrants Override
- **TD Panel Default Open**: Changed `showManagement` initial state to `true` so Quick Add Player and other TD tools are visible immediately when visiting an event page (was defaulting to collapsed/hidden)
- **Total Entrants Override**: New feature allowing TDs to override the player count used for points calculation
  - `totalEntrants` nullable Int field on Event model
  - Backend: `PUT /events/:id/total-entrants` route + `setTotalEntrants` service method
  - Frontend: Number input in TD Panel with Set/Clear buttons
  - Client API: `eventsAPI.setTotalEntrants(eventId, value)`
  - Migration: `20260211190000_add_total_entrants`

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
│   ├── admin/              # Multi-tab admin panel
│   ├── venues/             # Venue list + detail pages
│   └── auth/callback/      # Google OAuth callback handler
├── components/
│   ├── MobileNav.tsx       # Mobile hamburger navigation
│   ├── ImageUpload.tsx     # Base64 image upload component
│   ├── BalanceTab.tsx      # Admin: Lightning balance management
│   ├── WithdrawalsTab.tsx  # Admin: Withdrawal management
│   └── PointsTab.tsx       # Admin: Points adjustment UI
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
├── routes/                 # 9 route files (auth, venue, season, event, standings, admin, withdrawal, lnurl, balance)
├── services/               # 10 service files (business logic layer)
├── validators/             # 4 Zod validation schemas
├── types/express.d.ts      # Express type augmentation
└── lib/prisma.ts           # Prisma client singleton
```

### Database (Prisma / PostgreSQL)
15 models: User, Profile, Venue, Season, Event, EventSignup, Result, Standing, Achievement, UserAchievement, LightningChallenge, Comment, DeletedUser, Withdrawal, PointsHistory

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
- **Export/Reports**: CSV export of standings, results
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
