# Roatan Poker League - Active Context

## Current State (Updated: Feb 1, 2026)

The Roatan Poker League application is **LIVE and DEPLOYED** on Railway with **Phase 2 features + Tournament Director UI complete**!

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
11. **All database tables** - Complete Prisma schema deployed

### Live URLs
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api
- **Login Page**: https://client-production-41b3.up.railway.app/login

---

## Latest Changes (Feb 1, 2026)

### Profile Editing
- Users can now edit their display name and email from the profile page
- Especially useful for Lightning users who get auto-generated names like "Lightning_abc12345"
- Backend: `PUT /api/auth/profile` endpoint
- Frontend: "Edit Profile" button on profile page with inline editing

### Tournament Director Results Entry
- **TD Panel** appears on event detail page for users with TD/Admin/Venue Manager roles
- **Event Status Controls**: Change between Scheduled → Registration Open → In Progress
- **Attendance Tracking**: Checkboxes to mark which registered players actually showed up
- **Position Entry**: Enter finishing position for each player who attended
- **Knockout Tracking**: +/- buttons to track knockouts per player
- **Save Draft**: Save results without finalizing (can continue editing)
- **Finalize Results**: Lock results, mark event as COMPLETED, auto-update standings

### Cleanup
- Removed "Become Admin" button from profile page (admin already exists)
- Removed "multi-provider authentication" text from dashboard

---

## Phase 2 Features Completed

### Backend APIs
- **Venues** (`/api/venues`) - Full CRUD
- **Seasons** (`/api/seasons`) - Full CRUD with standings
- **Events** (`/api/events`) - Full CRUD with signups/results
- **Profile** (`/api/auth/profile`) - Update user name/email

### Frontend Pages
- `/events` - Events list with season filtering
- `/events/[id]` - Event detail with signup/cancel + TD Panel
- `/leaderboard` - Season standings
- `/profile` - User profile with edit functionality
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
  - `src/app/events/[id]/page.tsx` - Event detail with TD Panel
  - `src/app/leaderboard/` - Standings
  - `src/app/profile/page.tsx` - Profile with edit
  - `src/app/login/page.tsx` - Login with auto Lightning QR
  - `src/lib/api.ts` - API client

---

## How Tournament Director Results Entry Works

1. **TD/Admin/Venue Manager** navigates to an event detail page
2. **TD Panel** appears (orange-themed section)
3. **Change Event Status** if needed (Scheduled → Registration Open → In Progress)
4. **Mark Attendance**: Check the box for each player who showed up
5. **Enter Positions**: Type the finishing position (1st, 2nd, etc.) for each attended player
6. **Track Knockouts**: Use +/- buttons to record knockouts
7. **Save Draft**: Click to save progress (can edit later)
8. **Finalize Results**: Click to lock results and update standings
   - Validates all attended players have positions
   - Validates no duplicate positions
   - Submits results to API
   - Changes event status to COMPLETED
   - Triggers standings recalculation

---

## Next Steps When Returning

1. **Google OAuth** - Once credentials are provided
2. **Achievement/Badge System** - Display earned badges on profile
3. **Email Notifications** - For event reminders, results
4. **Production Hardening**:
   - Replace MemoryStore session with Redis
   - Add rate limiting per endpoint
   - Set up proper logging
