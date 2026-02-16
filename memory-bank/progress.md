# Progress — Roatan Poker League

## Last Updated: February 15, 2026

---

## ✅ What's Built & Working

### Authentication System
- [x] Email/password registration and login (bcrypt + JWT)
- [x] Lightning Login (LNURL-auth) — QR scan with Bitcoin wallet
- [x] Google OAuth callback handler (UI ready, needs credentials)
- [x] JWT token management (7-day expiry, Bearer header)
- [x] Role-based access control (Admin, Venue Manager, Tournament Director, Player)
- [x] Link Lightning wallet to existing account
- [x] Add email/password to Lightning-only account
- [x] Profile management (name, email updates)
- [x] Auth context (React Context for client-side auth state)

### Venue Management
- [x] Create, read, update, delete venues
- [x] Venue manager assignment
- [x] Venue list page (`/venues`)
- [x] Venue detail page (`/venues/[id]`) with upcoming events
- [x] Soft-delete (active/inactive toggle)
- [x] Hard-delete for admin
- [x] Zod validation for venue input

### Season Management
- [x] Create, read, update, delete seasons
- [x] Season activation/deactivation (only one active at a time)
- [x] Configurable points structure per season
- [x] Season standings with auto-recalculation
- [x] Zod validation for season input

### Event Management
- [x] Create single events with full details
- [x] Bulk event creation (recurring events)
- [x] Event list page (`/events`) with filtering
- [x] Event detail page (`/events/[id]`) with full lifecycle UI
- [x] Event status flow: DRAFT → REGISTRATION_OPEN → IN_PROGRESS → COMPLETED / CANCELLED
- [x] Configurable `registrationOpenDays` (default: 10 days before event)
- [x] Event image upload (base64, ImageUpload component)
- [x] Zod validation for event input

### Player Registration & Attendance
- [x] Player signup for events
- [x] Signup cancellation
- [x] Waitlist when event is full (auto-promotion on cancellation)
- [x] Check-in system for tournament directors
- [x] No-show processing
- [x] Signup status tracking (REGISTERED, WAITLISTED, CHECKED_IN, NO_SHOW, CANCELLED)

### Tournament Director Panel
- [x] Event status controls (advance through lifecycle)
- [x] Attendance management (check-in players)
- [x] Results entry (position, knockouts)
- [x] Draft save for results
- [x] Finalize results (locks in points)
- [x] Points preview before finalizing
- [x] Quick-add players (search existing or create guest)
- [x] Total entrants override (TD sets actual player count for points calc)
- [x] Dynamic extra player slots (blank search dropdowns appear when totalEntrants > attended count)
- [x] Extra slots react to attendance checkbox toggles (unchecking a player adds a blank slot)
- [x] Extra slot players included in save/finalize results

### Guest Player System
- [x] `isGuest` flag on User model for walk-in players
- [x] Guest account creation from TD panel
- [x] Guest merge tool in admin panel (transfers results, standings, signups)
- [x] "(guest)" label on leaderboard for guest players
- [x] Admin endpoints: `GET /admin/guest-users`, `POST /admin/merge-guest`
- [x] Claim links: Admin generates unique URL for guest to self-claim account (`/claim/[token]`)
- [x] Claim flow: Guest sets email + password → converts to real user, `isGuest` cleared

### Scoring & Standings
- [x] Dynamic points calculation (scales with checked-in player count)
- [x] Base pool: 10 pts for ≤10 players, +2 per additional player
- [x] Distribution: 60% / 30% / 10% for top 3 (rounded up)
- [x] Knockout bonuses
- [x] Season leaderboard page (`/leaderboard`)
- [x] Auto-recalculate standings on result entry
- [x] Player standings in dashboard

### Admin Panel (`/admin`)
- [x] Multi-tab interface: Venues, Seasons, Events, Users, Withdrawals, Balance, Points
- [x] Venue CRUD management
- [x] Season CRUD management
- [x] Event CRUD management
- [x] User role management
- [x] User deletion (soft-delete with archive)
- [x] Admin notes on users

### Points Management (Admin)
- [x] Manual point adjustments with reasons
- [x] Bulk point awards to multiple users
- [x] Points history audit trail (PointsHistory model)
- [x] Points Tab admin component

### Lightning Network
- [x] LNURL-auth: Challenge generation, QR display, signature verification
- [x] LNURL-withdraw: Full withdrawal flow (create → QR → scan → pay)
- [x] Voltage LND integration (REST API): node info, channel balance, invoice decode/pay
- [x] Per-user Lightning balance tracking (credit/debit/set)
- [x] Balance Tab admin component
- [x] Withdrawals Tab admin component
- [x] Withdrawal stats and management
- [x] Expired challenge/withdrawal cleanup
- [x] Lightning login E2E test script (`server/scripts/test-lightning-login.ts`) — 17 assertions, tests full LNURL-auth flow with real secp256k1 signing. Run: `npx ts-node scripts/test-lightning-login.ts` (local) or `--production` flag
- [x] Production DB migration fix (Feb 14): profileImage/bio columns were missing → added admin migration endpoint (`POST /admin/apply-migrations`) secured by `MIGRATION_SECRET` env var

### Last Longer Pool (Side Bet)
- [x] `lastLongerEnabled`, `lastLongerSeedSats` (default 10000), `lastLongerEntrySats` (default 25000) on Event model
- [x] `LastLongerEntry` model: tracks player entries with Lightning invoice payment
- [x] Backend service: `last-longer.service.ts` — createEntryInvoice, checkPayment, getPoolEntries, getPoolInfo, selectWinner, isUserEntered
- [x] Routes: `GET /events/:id/last-longer`, `POST /events/:id/last-longer/enter`, `GET /events/:id/last-longer/check-payment`, `POST /events/:id/last-longer/winner`
- [x] Client: "Enter Last Longer Pool" button on event page → Lightning invoice QR → auto-poll payment
- [x] Admin/TD: Pool status display + dropdown to select winner from paid entrants
- [x] Winner gets total pool (seed + all entries) credited to Lightning balance
- [x] Admin: Enable Last Longer checkbox + seed/entry fields in event creation form
- [x] Validator: lastLongerEnabled, lastLongerSeedSats, lastLongerEntrySats in event schemas
- [x] Migration: `20260215163000_add_last_longer_pool`
- [x] "⚡ Last Longer" badge on events list page and homepage event cards

### User Experience
- [x] Mobile-responsive design (MobileNav hamburger menu)
- [x] Home page with upcoming events and leaderboard preview
- [x] Player dashboard with personal events and standings
- [x] Profile page with account management

### Deployment
- [x] Railway deployment (client + server + PostgreSQL)
- [x] Nixpacks build configuration for both services
- [x] 8 database migrations applied successfully

---

## ❌ What's NOT Built Yet

### High Priority
- [ ] **Google OAuth activation** — UI and callback exist, just needs Google Cloud credentials
- [ ] **Email notifications** — Nodemailer + SendGrid dependency installed, no service built
- [ ] **Achievement/Badge system** — Schema exists (Achievement, UserAchievement models), no awarding logic or UI
- [ ] **Event comments** — Schema exists (Comment model), no routes or UI

### Medium Priority
- [ ] **Password reset flow** — No forgot-password email mechanism
- [ ] **Player statistics page** — Detailed per-player stats beyond standings
- [ ] **Event history/archive** — Past events browsing with filters
- [ ] **Redis session store** — Currently MemoryStore (fine for single Railway instance)
- [ ] **User withdrawal view** — Backend endpoint exists (`/api/withdrawals/my`), needs frontend page

### Low Priority / Nice-to-Have
- [ ] **Real-time updates** — WebSocket for live event status
- [ ] **Push notifications** — Event reminders
- [ ] **CSV export** — Standings, results, player data
- [ ] **Multi-language** — Spanish support for local audience
- [ ] **Dark mode** — Theme toggle
- [ ] **SEO optimization** — Meta tags, Open Graph

---

## 🗄️ Database Schema (16 Models)

| Model | Purpose |
|-------|---------|
| User | Core user account (email, password, role, lightningPubkey, balance) |
| Profile | Extended user info (bio, avatar, phone) |
| Venue | Poker venue (name, address, description, manager) |
| Season | League season (name, dates, points structure, active flag) |
| Event | Tournament event (date, venue, season, status, max players, buy-in) |
| EventSignup | Player registration for events (status: registered/waitlisted/checked_in/etc.) |
| Result | Tournament results (position, points, knockouts) |
| Standing | Season standings (total points, events played, rank) |
| Achievement | Achievement definitions (not yet used) |
| UserAchievement | User-achievement junction (not yet used) |
| LightningChallenge | LNURL-auth challenges (k1, pubkey, expiry) |
| Comment | Event comments (not yet used) |
| DeletedUser | Archived user data on soft-delete |
| Withdrawal | Lightning withdrawal records (amount, status, LNURL data) |
| PointsHistory | Audit trail for all point changes |
| LastLongerEntry | Last Longer pool entries with Lightning invoice payment tracking |

---

## 📊 API Routes Summary

| Route File | Base Path | Key Endpoints |
|------------|-----------|---------------|
| auth.routes | `/api/auth` | register, login, google, lightning (challenge/verify/status), me, profile, link-lightning, add-email |
| venue.routes | `/api/venues` | CRUD, assign-manager, by-manager |
| season.routes | `/api/seasons` | CRUD, activate, current, standings, recalculate |
| event.routes | `/api/events` | CRUD, bulk-create, signup, cancel, check-in, results, enter-results, points-preview, status, process-no-shows, adjust-points, last-longer (pool info, enter, check-payment, winner) |
| standings.routes | `/api/standings` | current, by-season, by-player, my-standing, my-all-seasons, recalculate |
| admin.routes | `/api/admin` | users, user CRUD, role management, points (adjust/bulk/history), admin-notes, generate-claim-link, guest-users, merge-guest |
| withdrawal.routes | `/api/withdrawals` | create, list, my-withdrawals, cancel, stats |
| lnurl.routes | `/api/lnurl` | withdraw (LNURL-withdraw protocol endpoints) |
| balance.routes | `/api/balance` | user-balance, all-balances, credit, debit, set, stats |

---

## 🔄 Migration History

| Migration | Date | Description |
|-----------|------|-------------|
| `20260201220000` | Feb 1 | Add `nameSetAt` field to User |
| `20260202201500` | Feb 2 | Add `imageUrl` to Event |
| `20260202210800` | Feb 2 | Add Withdrawal model |
| `20260202230100` | Feb 2 | Add `lightningBalance` to User |
| `20260204181000` | Feb 4 | Add DeletedUser model |
| `20260204190000` | Feb 4 | Add PointsHistory model |
| `20260204200000` | Feb 4 | Add waitlist fields + points adjustments |
| `20260205162200` | Feb 5 | Add `registrationOpenDays` to Event |
| `20260210170000` | Feb 10 | Add `isGuest` flag to User |
| `20260210180000` | Feb 10 | Add `claimToken` + `claimTokenExpiry` to User |
| `20260211190000` | Feb 11 | Add `totalEntrants` to Event |
| `20260211200000` | Feb 11 | Add Faq model |
| `20260214152400` | Feb 14 | Add `registrationCloseMinutes` to Event |
| `20260214160000` | Feb 14 | Add `profileImage` + `bio` to Profile |
| `20260214170000` | Feb 14 | Add VenueApplication model |
| `20260215163000` | Feb 15 | Add Last Longer Pool (Event fields + LastLongerEntry model) |
