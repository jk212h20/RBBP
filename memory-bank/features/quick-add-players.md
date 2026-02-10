# Feature: Quick Add Players (Tournament Director)

## Created: February 10, 2026
## Status: In Progress

## Problem
Tournament directors can't easily enter attendance/results for players who:
1. Have an account but didn't pre-register for the event
2. Don't have an account at all (walk-in guests at casual events)

Currently, the TD panel only shows players from `event.signups`, so unregistered players are invisible to the director.

## Solution: Multi-Session Implementation

### Session 1+2: Backend + Quick Add Existing Users ← CURRENT
**Goal:** Director can search for existing users and add them to an event without the user needing to self-register.

**Backend changes:**
1. Schema: Add `isGuest Boolean @default(false)` to User model + migration
2. New endpoint: `GET /api/users/search?q=name` (TD/Admin only) — search users by name
3. New endpoint: `POST /api/events/:id/quick-add` (TD/Admin only) — add existing user to event bypassing normal signup flow
4. API client: Add `searchUsers()` and `quickAddPlayer()` to `api.ts`

**Frontend changes:**
5. TD Panel: Add "➕ Quick Add Player" section with autocomplete search
6. Search → select → add flow with debounced search
7. Player appears in attendance list immediately after adding
8. Handle edge cases (already signed up, no results found)

**Files to modify:**
- `server/prisma/schema.prisma` — add isGuest field
- `server/src/routes/event.routes.ts` — add quick-add endpoint
- `server/src/routes/admin.routes.ts` or new `user.routes.ts` — add search endpoint
- `server/src/services/event.service.ts` — add quickAddPlayer service method
- `server/src/validators/event.validator.ts` — add quick-add validation
- `client/src/lib/api.ts` — add API client methods
- `client/src/app/events/[id]/page.tsx` — add Quick Add UI to TD panel

### Session 3: Guest Player Creation (FUTURE)
**Goal:** Director can type a name and create a guest stub account for walk-ins with no account.

**Changes:**
1. Extend `POST /api/events/:id/quick-add` to accept `{ name: string }` (no userId) — creates guest User + signup
2. UI: "Add as Guest" button when search returns no matches
3. Visual distinction: Guest players show 👤 badge in attendance/results
4. Guest users earn points normally (tracked on stub account)

### Session 4: Guest Account Claiming & Merge (FUTURE)
**Goal:** Admin can merge guest records into real accounts when guests later sign up.

**Changes:**
1. Admin UI: "Merge Guest" tool — select guest → select real user → transfer all data
2. Backend: Merge endpoint that reassigns all foreign keys from guest to real user
3. Leaderboard: Guest players shown with "(guest)" label

## Design Decisions
- **Stub accounts over nullable userId**: Keep `userId` required on EventSignup/Result. Create minimal User records for guests instead. This avoids null-handling throughout the codebase.
- **Points tracked on guest records**: Guests earn points normally. When merged, points transfer to real account.
- **No waitlist bypass**: Quick-add ignores maxPlayers/waitlist — director is explicitly choosing to add someone.
- **Search is name-only**: Simple ILIKE search on user name. No email search needed for this use case.
