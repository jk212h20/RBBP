# System Patterns — Roatan Poker League

## Last Updated: February 10, 2026

---

## Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│   Next.js Client    │────▶│   Express Server     │────▶│  PostgreSQL  │
│   (React 19 SPA)    │◀────│   (REST API)         │◀────│  (Prisma)    │
│   Port 3000         │     │   Port 3001          │     │              │
└─────────────────────┘     └──────────┬───────────┘     └──────────────┘
                                       │
                                       ▼
                            ┌─────────────────────┐
                            │   Voltage LND Node   │
                            │   (Lightning Network) │
                            └─────────────────────┘
```

The app follows a **client-server architecture** with a clear separation:
- **Client**: Next.js App Router (server-side rendering + client components)
- **Server**: Express.js REST API with service layer pattern
- **Database**: PostgreSQL accessed via Prisma ORM
- **External**: Voltage LND node for Lightning Network operations

---

## Server-Side Patterns

### Service Layer Pattern
All business logic lives in `server/src/services/`. Routes are thin controllers that:
1. Parse/validate request input (using Zod validators)
2. Call service functions
3. Return JSON responses

```
Route (thin controller) → Validator (Zod) → Service (business logic) → Prisma (database)
```

**Example flow for event signup:**
```
POST /api/events/:id/signup
  → auth.middleware (verify JWT, extract user)
  → event.routes (parse params)
  → eventService.signupForEvent(eventId, userId)
    → Check event exists & is open
    → Check if already signed up
    → Check capacity → register or waitlist
    → Return signup status
```

### Service File Organization
- **Class-based services**: `EventService`, `SeasonService`, `VenueService`, `StandingsService`, `PointsService` — instantiated as singletons
- **Function-based services**: `auth.service`, `balance.service`, `lightning.service`, `voltage.service`, `withdrawal.service` — exported as standalone functions

### Validation Pattern (Zod)
Input validation uses Zod schemas in `server/src/validators/`:
- `auth.validator.ts` — RegisterInput, LoginInput, UpdateProfileInput
- `event.validator.ts` — CreateEventInput, UpdateEventInput, BulkCreateEventsInput, ResultEntry
- `season.validator.ts` — CreateSeasonInput, UpdateSeasonInput
- `venue.validator.ts` — CreateVenueInput, UpdateVenueInput

Validators are called in routes before passing data to services.

### Authentication & Authorization

**JWT Flow:**
1. User logs in → server returns JWT token (7-day expiry)
2. Client stores token in localStorage (via AuthContext)
3. Client sends `Authorization: Bearer <token>` on every API request
4. `auth.middleware.ts` verifies token and attaches `req.user`

**Middleware chain:**
- `requireAuth` — Verifies JWT, attaches user to request
- `requireAdmin` — Checks `user.role === 'ADMIN'`
- `requireRole(...roles)` — Checks user has one of the specified roles

**Role hierarchy:**
```
ADMIN > VENUE_MANAGER > TOURNAMENT_DIRECTOR > PLAYER
```

**Lightning Auth (LNURL-auth):**
1. Client requests challenge → server generates k1 + LNURL QR
2. User scans QR with Lightning wallet → wallet signs k1 with node pubkey
3. Wallet calls server callback with signature
4. Server verifies signature → creates/finds user → returns JWT

### Event Status Flow
```
DRAFT → REGISTRATION_OPEN → IN_PROGRESS → COMPLETED
                                        → CANCELLED
```

- **DRAFT**: Event created, not visible to players for signup
- **REGISTRATION_OPEN**: Players can sign up (auto-opens based on `registrationOpenDays`)
- **IN_PROGRESS**: Tournament running, check-ins active, no new signups
- **COMPLETED**: Results finalized, points awarded
- **CANCELLED**: Event cancelled, all signups voided

### Points Calculation
```typescript
function calculateEventPoints(checkedInCount: number) {
  // Base pool: 10 for ≤10 players, +2 per player beyond 10
  const basePool = checkedInCount <= 10 ? 10 : 10 + (checkedInCount - 10) * 2;
  
  return {
    first: Math.ceil(basePool * 0.6),   // 60%
    second: Math.ceil(basePool * 0.3),  // 30%
    third: Math.ceil(basePool * 0.1),   // 10%
    knockout: 1                          // 1 point per knockout
  };
}
```

### Waitlist System
When an event has `maxPlayers` set:
1. First N signups get `REGISTERED` status
2. Additional signups get `WAITLISTED` status with `waitlistPosition`
3. When a registered player cancels → `promoteFromWaitlist()` auto-promotes next in line
4. Waitlist positions are maintained in order

### Lightning Withdrawal Flow (LNURL-withdraw)
```
1. Admin creates withdrawal (userId, amount in sats)
   → Generates k1 + LNURL-withdraw URL
   → Stores in Withdrawal table

2. User scans QR code with Lightning wallet
   → Wallet calls GET /api/lnurl/withdraw?k1=xxx
   → Server returns: {tag: "withdrawRequest", minSendable, maxSendable, callback}

3. Wallet generates invoice, calls callback with invoice
   → Server decodes invoice, verifies amount
   → Server pays invoice via Voltage LND
   → Updates withdrawal status to COMPLETED
   → Debits user's Lightning balance
```

---

## Client-Side Patterns

### Next.js App Router
All pages use the App Router (`client/src/app/`). Pages are organized by feature:
- Most pages are client components (`'use client'`) for interactivity
- Layout wraps all pages with AuthProvider and navigation

### Auth Context Pattern
`AuthContext.tsx` provides:
- `user` — Current user object (or null)
- `token` — JWT token string
- `login(token)` — Store token, decode user
- `logout()` — Clear token, redirect to home
- `loading` — Auth initialization state

All API calls go through `lib/api.ts` which automatically attaches the Bearer token.

### API Client Pattern
`lib/api.ts` exports a centralized `fetchAPI<T>()` function:
- Automatically prepends `NEXT_PUBLIC_API_URL`
- Attaches JWT token from localStorage
- Handles JSON parsing
- Throws on non-OK responses

### Component Organization
- **Pages** (`app/*/page.tsx`): Full page components with data fetching
- **Components** (`components/*.tsx`): Reusable UI pieces (admin tabs, image upload, mobile nav)
- **Context** (`context/*.tsx`): React Context providers
- **Lib** (`lib/*.ts`): Utility functions

### Admin Panel Structure
The admin page (`/admin`) uses a tab-based interface:
- Each tab is either inline in the admin page or a separate component
- Tab components: `BalanceTab`, `WithdrawalsTab`, `PointsTab`
- Tabs: Venues | Seasons | Events | Users | Withdrawals | Balance | Points

---

## Database Patterns

### Prisma Client Singleton
`server/src/lib/prisma.ts` exports a singleton Prisma client to avoid connection pool exhaustion during development (hot reload).

### Soft Delete Pattern
Users are never hard-deleted. Instead:
1. User data is serialized to JSON and stored in `DeletedUser` table
2. Original `User` record is then deleted
3. This preserves audit trail while cleaning up foreign key references

### Relation Patterns
- **User → Profile**: One-to-one (optional profile)
- **User → EventSignup → Event**: Many-to-many through junction
- **Event → Venue**: Many-to-one
- **Event → Season**: Many-to-one
- **Result → Event + User**: Composite relation
- **Standing → Season + User**: Composite relation with unique constraint

### Migration Strategy
Migrations are created with `npx prisma migrate dev` and committed to git. Each migration is a timestamped SQL file in `server/prisma/migrations/`. Railway auto-runs migrations on deploy via the build command in `nixpacks.toml`.

---

## Deployment Patterns

### Railway Configuration
Both client and server have:
- `nixpacks.toml` — Build configuration (install, build, start commands)
- `railway.toml` — Railway-specific settings

**Server nixpacks.toml:**
```toml
[phases.setup]
nixPkgs = ["...", "nodejs_18"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npx prisma generate", "npx prisma migrate deploy", "npm run build"]

[start]
cmd = "node dist/index.js"
```

**Client nixpacks.toml:**
```toml
[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

### Environment Variable Strategy
- Secrets (JWT_SECRET, DATABASE_URL) are set in Railway dashboard
- Client only needs `NEXT_PUBLIC_API_URL` (public, safe to expose)
- Voltage credentials are optional (Lightning features degrade gracefully)
- Google OAuth credentials are optional (login tab hidden if not configured)

---

## Key Files for New Developers

| File | What It Does | Start Here If... |
|------|-------------|-------------------|
| `server/src/index.ts` | Express app setup, all route mounting | Understanding the API structure |
| `server/prisma/schema.prisma` | Complete database schema | Understanding data models |
| `server/src/services/event.service.ts` | Largest service, full event lifecycle | Understanding business logic |
| `server/src/middleware/auth.middleware.ts` | JWT verification, role checks | Understanding auth flow |
| `client/src/context/AuthContext.tsx` | Client auth state management | Understanding frontend auth |
| `client/src/lib/api.ts` | API client utility | Understanding API calls |
| `client/src/app/admin/page.tsx` | Admin panel with all tabs | Understanding admin features |
| `client/src/app/events/[id]/page.tsx` | Event detail + TD controls | Understanding event lifecycle UI |
