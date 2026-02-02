# Roatan Poker League - Active Context

## Current State (Updated: Feb 2, 2026)

The Roatan Poker League application is **LIVE and DEPLOYED** on Railway with **Phase 2 features + Season Points System complete**!

### What's Working ✅
1. **Email/Password Authentication** - Users can register and login with email/password
2. **Lightning Login (LNURL-auth)** - Bitcoin Lightning wallet authentication (QR auto-shows on login)
3. **Profile Editing** - Users can update their name and email (especially useful for Lightning users)
4. **Full Frontend** - Next.js 16 app with poker-themed UI
5. **Full Backend** - Express.js API with PostgreSQL database
6. **Venues Management** - Full CRUD for poker venues
7. **Seasons Management** - Create/manage seasons with points structure
8. **Events Management** - Create events, signups, check-ins, results
9. **Leaderboards** - Real-time standings with automatic calculation
10. **Tournament Director Panel** - Full results entry UI for TDs/Admins
11. **Season-Based Points System** - Points per season with registration bonuses/penalties
12. **Improved Admin Dashboard** - Clickable stat panels with rich overview

### Live URLs
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api
- **Login Page**: https://client-production-41b3.up.railway.app/login

---

## Latest Changes (Feb 2, 2026)

### Season-Based Points System
- **Points are now per-season** - When a new season starts, users start fresh with 0 points
- **Registration Points**: +1 point for registering to an event
- **Cancellation Penalties**:
  - Early cancellation (24+ hours before): -1 point (removes registration bonus)
  - Late cancellation (less than 24 hours): -2 points (penalty)
  - No-show: -3 points (registered but didn't attend)
- **User Dashboard**: Shows current season points prominently
- **Profile Page**: Shows season points card with rank, events, wins, knockouts
- **API Endpoints**:
  - `GET /api/standings/my` - Get current user's standing for active season
  - `GET /api/standings/user/:userId/history` - Admin endpoint for all seasons history

### Admin Dashboard Improvements
- **Clickable Stat Panels**: The 4 stat cards (Users, Venues, Seasons, Events) are now clickable buttons that navigate to their respective tabs
- **Rich Overview**:
  - Active Season info card showing current season name, dates, and stats
  - Quick Stats grid showing active venues, total seasons, upcoming/completed events
  - Upcoming Events list showing next 5 events with status and signup counts
- **Visual Improvements**: Hover effects, icons, and "Click to manage →" hints

---

## Points System Details

### How Points Work
1. **Registration**: User registers for event → +1 point
2. **Early Cancel**: User cancels 24+ hours before → -1 point (net 0)
3. **Late Cancel**: User cancels <24 hours before → -2 points (net -1)
4. **No-Show**: User registered but didn't check in → -3 points (net -2)
5. **Event Results**: Points from finishing position + knockouts (per season config)

### Implementation
- Points stored in `Standing` table (already per-season via `seasonId`)
- `adjustUserSeasonPoints()` method in EventService handles point changes
- `processNoShows()` method marks no-shows and applies penalties
- Points never go below 0

---

## Phase 2 Features Completed

### Backend APIs
- **Venues** (`/api/venues`) - Full CRUD
- **Seasons** (`/api/seasons`) - Full CRUD with standings
- **Events** (`/api/events`) - Full CRUD with signups/results + point adjustments
- **Profile** (`/api/auth/profile`) - Update user name/email
- **Standings** (`/api/standings`) - Current standings, user standings, history

### Frontend Pages
- `/events` - Events list with season filtering
- `/events/[id]` - Event detail with signup/cancel + TD Panel
- `/leaderboard` - Season standings
- `/profile` - User profile with season points card
- `/dashboard` - User dashboard with season points display
- `/admin` - Admin panel with clickable overview panels
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
  - `src/routes/` - auth, venue, season, event, standings routes
  - `src/services/` - Business logic (event.service.ts has points logic)
  - `src/validators/` - Zod schemas
  - `prisma/schema.prisma` - Database schema

### Frontend (client/)
- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context for auth
- **Key Files**:
  - `src/app/page.tsx` - Homepage
  - `src/app/events/` - Events pages
  - `src/app/events/[id]/page.tsx` - Event detail with TD Panel
  - `src/app/leaderboard/` - Standings
  - `src/app/profile/page.tsx` - Profile with season points
  - `src/app/dashboard/page.tsx` - Dashboard with season points
  - `src/app/admin/page.tsx` - Admin with clickable overview
  - `src/app/login/page.tsx` - Login with auto Lightning QR
  - `src/lib/api.ts` - API client

---

## Next Steps When Returning

1. **Google OAuth** - Once credentials are provided
2. **Achievement/Badge System** - Display earned badges on profile
3. **Email Notifications** - For event reminders, results
4. **Points History Page** - Admin view of user points across all seasons
5. **Production Hardening**:
   - Replace MemoryStore session with Redis
   - Add rate limiting per endpoint
   - Set up proper logging
