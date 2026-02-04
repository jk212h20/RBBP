# Roatan Poker League - Active Context

## Current State (Updated: Feb 2, 2026)

The Roatan Poker League application is **LIVE and DEPLOYED** on Railway with **Lightning Withdrawals (LNURL-withdraw) now implemented**!

### What's Working ✅
1. **Email/Password Authentication** - Users can register and login with email/password
2. **Lightning Login (LNURL-auth)** - Bitcoin Lightning wallet authentication (QR auto-shows on login)
3. **Lightning Withdrawals (LNURL-withdraw)** - Admin can send sats to players via QR code
4. **Profile Editing** - Users can update their name and email
5. **Full Frontend** - Next.js 16 app with poker-themed UI
6. **Full Backend** - Express.js API with PostgreSQL database
7. **Venues Management** - Full CRUD for poker venues
8. **Seasons Management** - Create/manage seasons with points structure
9. **Events Management** - Create events, signups, check-ins, results
10. **Leaderboards** - Real-time standings with automatic calculation
11. **Tournament Director Panel** - Full results entry UI for TDs/Admins
12. **Season-Based Points System** - Points per season with registration bonuses/penalties
13. **Admin Withdrawals Tab** - Create and manage Lightning payouts

### Live URLs
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api
- **Login Page**: https://client-production-41b3.up.railway.app/login

---

## Latest Changes (Feb 2, 2026)

### Lightning Withdrawals (LNURL-withdraw) - NEW!
Players can now receive sats from the site using the LNURL-withdraw protocol. This is the standard way to send Bitcoin Lightning payments - the admin creates a withdrawal, and the player scans a QR code with their wallet to receive the sats.

**Why LNURL-withdraw instead of bolt11?**
- **Better UX**: Player just scans a QR code - no need to generate an invoice
- **Standard Protocol**: Works with all major Lightning wallets (Phoenix, Wallet of Satoshi, Zeus, etc.)
- **Admin Control**: Admin creates the withdrawal, player claims it
- **Expiration**: Withdrawals expire after 24 hours if not claimed

**New Backend Components:**
- `Withdrawal` model in Prisma schema (status: PENDING → CLAIMED → PAID)
- `voltage.service.ts` - LND REST API integration for Voltage nodes
- `withdrawal.service.ts` - Business logic for creating/managing withdrawals
- `lnurl.routes.ts` - LNURL-withdraw protocol endpoints (wallet callbacks)
- `withdrawal.routes.ts` - Admin API for managing withdrawals

**New Frontend Components:**
- `WithdrawalsTab` component in admin panel
- Shows Lightning node status (connected/balance)
- Create withdrawal form (select user, amount, description)
- QR code modal for sharing with players
- Withdrawal history with status badges

**Environment Variables Required:**
```
VOLTAGE_REST_HOST=https://your-node.voltage.cloud:8080
VOLTAGE_MACAROON=your-admin-macaroon-hex-encoded
LNURL_BASE_URL=https://rbbp-production.up.railway.app/api
```

**API Endpoints:**
- `POST /api/withdrawals` - Create withdrawal (admin)
- `GET /api/withdrawals` - List all withdrawals (admin)
- `GET /api/withdrawals/stats` - Get withdrawal statistics (admin)
- `GET /api/withdrawals/node-status` - Check Lightning node connection (admin)
- `DELETE /api/withdrawals/:id` - Cancel pending withdrawal (admin)
- `GET /api/withdrawals/my` - Get user's withdrawals
- `GET /api/lnurl/withdraw/:k1` - LNURL-withdraw callback (wallet)
- `GET /api/lnurl/withdraw/:k1/callback` - Invoice submission (wallet)

---

## How Lightning Withdrawals Work

### Flow:
1. **Admin creates withdrawal** in admin panel (selects user, enters amount)
2. **System generates LNURL** with unique k1 identifier
3. **Admin shows QR code** to player (or sends link)
4. **Player scans with wallet** (Phoenix, WoS, Zeus, etc.)
5. **Wallet calls LNURL endpoint** to get withdrawal parameters
6. **Wallet generates invoice** and submits to callback
7. **Server pays invoice** via Voltage LND node
8. **Withdrawal marked PAID** in database

### Withdrawal Statuses:
- `PENDING` - Created, waiting for player to claim
- `CLAIMED` - Player's wallet has requested payment
- `PAID` - Invoice paid successfully
- `EXPIRED` - Not claimed within 24 hours
- `FAILED` - Payment failed

---

## Architecture Summary

### Backend (server/)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL on Railway
- **ORM**: Prisma
- **Auth**: JWT tokens + Lightning LNURL-auth
- **Lightning**: Voltage LND node via REST API
- **Key Files**:
  - `src/index.ts` - Main server entry
  - `src/routes/` - auth, venue, season, event, standings, withdrawal, lnurl routes
  - `src/services/` - Business logic
  - `src/services/voltage.service.ts` - LND REST API client
  - `src/services/withdrawal.service.ts` - Withdrawal business logic
  - `prisma/schema.prisma` - Database schema with Withdrawal model

### Frontend (client/)
- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context for auth
- **Key Files**:
  - `src/app/admin/page.tsx` - Admin with Withdrawals tab
  - `src/components/WithdrawalsTab.tsx` - Withdrawal management UI
  - `src/lib/api.ts` - API client with withdrawalsAPI

---

## Pending Items

### Google OAuth (Waiting on User)
The Google OAuth UI is complete but needs credentials:
- Need `GOOGLE_CLIENT_ID` 
- Need `GOOGLE_CLIENT_SECRET`
- Redirect URI to configure: `https://rbbp-production.up.railway.app/api/auth/google/callback`

### Voltage Node Setup
To enable Lightning withdrawals in production:
1. Create a Voltage node (or use existing LND node)
2. Get the REST API host URL
3. Get the admin macaroon (hex encoded)
4. Add to Railway environment variables

---

## Next Steps When Returning

1. **Voltage Node Setup** - Configure production Lightning node
2. **User Withdrawal View** - Show pending withdrawals on user dashboard
3. **Google OAuth** - Once credentials are provided
4. **Achievement/Badge System** - Display earned badges on profile
5. **Email Notifications** - For event reminders, results
6. **Production Hardening**:
   - Replace MemoryStore session with Redis
   - Add rate limiting per endpoint
   - Set up proper logging

---

## Latest Changes (Feb 4, 2026)

### Dynamic Points System & Waitlist - NEW!

Implemented a new dynamic points calculation system and waitlist functionality:

**Points Calculation:**
- Base pool: 10 points for 10 or fewer players
- +2 points per player beyond 10 (based on checked-in count)
- Distribution: 60% / 30% / 10% (rounded up)
- Only top 3 places get points
- Example: 10 players = 6/3/1 pts, 20 players = 18/9/3 pts

**Waitlist System:**
- Events now default to 20 max players (configurable)
- When event is full, new signups go to WAITLISTED status
- Users see their waitlist position (e.g., "#3 on waitlist")
- When someone cancels, next waitlisted person is promoted
- Waitlisted players don't get registration points until promoted

**New Backend Components:**
- `calculateEventPoints()` function in event.service.ts
- `getWaitlistPosition()` method
- `promoteFromWaitlist()` method
- `getPointsPreview()` endpoint
- WAITLISTED status added to SignupStatus enum

**New Frontend Features:**
- Points Pool Preview in TD panel (shows 1st/2nd/3rd points)
- Waitlist position display for users
- "Join Waitlist" button when event is full
- Waitlist section in registered players list
- Check-in status indicators

**Database Migration:**
- Added WAITLISTED to SignupStatus enum
- Changed default maxPlayers from 50 to 20
- Updated existing events to maxPlayers=20

**API Endpoints:**
- `GET /api/events/:id/points-preview` - Get points breakdown
- `GET /api/events/:id/waitlist-position` - Get user's waitlist position
