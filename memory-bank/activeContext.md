# Roatan Poker League - Active Context

## Current State (Updated: Feb 1, 2026)

The Roatan Poker League application is **LIVE and DEPLOYED** on Railway with **Phase 2 features complete**!

### What's Working ✅
1. **Email/Password Authentication** - Users can register and login with email/password
2. **Lightning Login (LNURL-auth)** - Bitcoin Lightning wallet authentication (QR auto-shows on login)
3. **Full Frontend** - Next.js 16 app with poker-themed UI
4. **Full Backend** - Express.js API with PostgreSQL database
5. **Venues Management** - Full CRUD for poker venues
6. **Seasons Management** - Create/manage seasons with points structure
7. **Events Management** - Create events, signups, check-ins, results
8. **Leaderboards** - Real-time standings with automatic calculation
9. **All database tables** - Complete Prisma schema deployed

### Live URLs
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api
- **Login Page**: https://client-production-41b3.up.railway.app/login

---

## Phase 2 Features Completed

### Backend APIs
- **Venues** (`/api/venues`)
  - GET / - List all venues
  - GET /:id - Get venue details
  - POST / - Create venue (Admin)
  - PUT /:id - Update venue (Admin/Manager)
  - DELETE /:id - Delete venue (Admin)

- **Seasons** (`/api/seasons`)
  - GET / - List all seasons
  - GET /current - Get active season
  - GET /:id - Get season with events/standings
  - GET /:id/standings - Get leaderboard
  - POST / - Create season (Admin)
  - PUT /:id - Update season (Admin)
  - PUT /:id/activate - Set as current season
  - POST /:id/recalculate - Recalculate standings

- **Events** (`/api/events`)
  - GET / - List events (with filters)
  - GET /upcoming - Get upcoming events
  - GET /my - Get user's events
  - GET /:id - Get event details
  - POST / - Create event (Admin/Director)
  - PUT /:id - Update event
  - PUT /:id/status - Update status
  - DELETE /:id - Delete event
  - POST /:id/signup - Register for event
  - DELETE /:id/signup - Cancel registration
  - GET /:id/signups - Get registered players
  - PUT /:id/checkin/:userId - Check in player
  - POST /:id/results - Enter results
  - GET /:id/results - Get results

### Frontend Pages
- `/events` - Events list with season filtering
- `/events/[id]` - Event detail with signup/cancel
- `/leaderboard` - Season standings
- Updated homepage with upcoming events & top players
- Login page auto-shows Lightning QR (no click required)

---

## Pending Items

### Google OAuth (Waiting on User)
The Google OAuth UI is complete but needs credentials:
- Need `GOOGLE_CLIENT_ID` 
- Need `GOOGLE_CLIENT_SECRET`
- Redirect URI to configure: `https://rbbp-production.up.railway.app/api/auth/google/callback`

---

## Architecture Summary

### Backend (server/)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL on Railway
- **ORM**: Prisma
- **Auth**: JWT tokens + Lightning LNURL-auth
- **Key Files**:
  - `src/index.ts` - Main server entry
  - `src/routes/` - auth, venue, season, event routes
  - `src/services/` - Business logic
  - `src/validators/` - Zod schemas
  - `prisma/schema.prisma` - Database schema

### Frontend (client/)
- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context for auth
- **Key Files**:
  - `src/app/page.tsx` - Homepage
  - `src/app/events/` - Events pages
  - `src/app/leaderboard/` - Standings
  - `src/app/login/page.tsx` - Login with auto Lightning QR
  - `src/lib/api.ts` - API client

---

## Next Steps When Returning

1. **Google OAuth** - Once credentials are provided
2. **Admin Dashboard** - UI for managing venues/seasons/events
3. **User Profiles** - Player stats and history
4. **Production Hardening**:
   - Replace MemoryStore session with Redis
   - Add rate limiting per endpoint
   - Set up proper logging
