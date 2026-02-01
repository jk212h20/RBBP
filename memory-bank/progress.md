# Roatan Poker League - Progress

## 🎉 Current Status: DEPLOYED & WORKING

### Live URLs
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api
- **GitHub**: https://github.com/jk212h20/RBBP

---

## ✅ What Works

### Authentication System
- [x] **Email/Password Login** - Fully working
- [x] **Email/Password Registration** - Fully working  
- [x] **Lightning Login (LNURL-auth)** - Fully working ⚡
- [ ] **Google OAuth** - UI ready, awaiting Google credentials

### Backend (Express.js + PostgreSQL)
- [x] Server deployed to Railway
- [x] PostgreSQL database connected
- [x] Prisma ORM with full schema
- [x] JWT token authentication
- [x] Health check endpoint
- [x] CORS configured for client

### Frontend (Next.js 16)
- [x] Client deployed to Railway
- [x] Homepage with poker theme
- [x] Login page with all auth methods
- [x] Registration page
- [x] Dashboard (protected route)
- [x] Auth callback handler
- [x] Responsive design

### Database Schema
All tables created:
- `users` - User accounts with multi-auth support
- `profiles` - User profiles/stats
- `venues` - Poker venues
- `seasons` - League seasons
- `events` - Tournament events
- `event_signups` - Registrations
- `results` - Tournament results
- `standings` - Season standings
- `achievements` - Badges
- `user_achievements` - Earned badges
- `lightning_challenges` - LNURL-auth challenges
- `comments` - Event comments

---

## 🚧 What's Left to Build

### Authentication
- [ ] Google OAuth (needs CLIENT_ID & CLIENT_SECRET from Google Console)

### Core Features (Phase 2)
- [ ] Events management (CRUD)
- [ ] Season management
- [ ] Tournament scoring system
- [ ] Real-time leaderboards
- [ ] Venue management
- [ ] User profiles

### Nice to Have
- [ ] Achievement/badge system
- [ ] Event comments
- [ ] Email notifications
- [ ] Admin dashboard

---

## Technical Notes

### Environment Variables (Railway - RBBP Server)
```
DATABASE_URL=<auto-set by Railway>
JWT_SECRET=<set>
JWT_REFRESH_SECRET=<set>
SESSION_SECRET=<set>
CORS_ORIGIN=https://client-production-41b3.up.railway.app
LIGHTNING_AUTH_URL=https://rbbp-production.up.railway.app/api/auth/lightning
```

### Environment Variables (Railway - Client)
```
NEXT_PUBLIC_API_URL=https://rbbp-production.up.railway.app/api
```

### Google OAuth Setup (When Ready)
Need to:
1. Create project in Google Cloud Console
2. Enable OAuth consent screen
3. Create OAuth 2.0 credentials
4. Add authorized redirect URI: `https://rbbp-production.up.railway.app/api/auth/google/callback`
5. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Railway

---

## Recent Fixes Applied
1. ESM/CommonJS compatibility - Downgraded @noble/secp256k1 to v1.7.1
2. Next.js 16 Suspense boundary for useSearchParams
3. Node.js 22 for Next.js 16 compatibility
4. Lightning signature verification (tries both hashed and raw k1)
5. LIGHTNING_AUTH_URL environment variable set correctly
6. Database schema pushed to Railway PostgreSQL
