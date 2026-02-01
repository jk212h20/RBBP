# Roatan Poker League - Active Context

## Current State (Updated: Feb 1, 2026)

The Roatan Poker League application is **LIVE and DEPLOYED** on Railway!

### What's Working ✅
1. **Email/Password Authentication** - Users can register and login with email/password
2. **Lightning Login (LNURL-auth)** - Bitcoin Lightning wallet authentication is fully functional
3. **Full Frontend** - Next.js 16 app with poker-themed UI
4. **Full Backend** - Express.js API with PostgreSQL database
5. **All database tables** - Complete Prisma schema deployed

### Live URLs
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api
- **Login Page**: https://client-production-41b3.up.railway.app/login

---

## Pending Items

### Google OAuth (Waiting on User)
The Google OAuth UI is complete but needs credentials:
- Need `GOOGLE_CLIENT_ID` 
- Need `GOOGLE_CLIENT_SECRET`
- Redirect URI to configure: `https://rbbp-production.up.railway.app/api/auth/google/callback`

When ready, add these to Railway RBBP service environment variables.

---

## Architecture Summary

### Backend (server/)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL on Railway
- **ORM**: Prisma
- **Auth**: JWT tokens + Lightning LNURL-auth
- **Key Files**:
  - `src/index.ts` - Main server entry
  - `src/routes/auth.routes.ts` - All auth endpoints
  - `src/services/lightning.service.ts` - LNURL-auth implementation
  - `prisma/schema.prisma` - Database schema

### Frontend (client/)
- **Framework**: Next.js 16 with TypeScript
- **Styling**: Tailwind CSS
- **State**: React Context for auth
- **Key Files**:
  - `src/app/page.tsx` - Homepage
  - `src/app/login/page.tsx` - Login page
  - `src/app/register/page.tsx` - Registration
  - `src/context/AuthContext.tsx` - Auth state management

---

## Recent Session Work

### Issues Fixed
1. **ESM/CommonJS compatibility** - `@noble/secp256k1` v3.x is ESM-only, downgraded to v1.7.1
2. **Next.js 16 Suspense** - `useSearchParams()` requires Suspense boundary in auth callback
3. **Node.js version** - Upgraded to Node 22 for Next.js 16 compatibility
4. **Lightning signature verification** - Now tries both SHA256(k1) and raw k1
5. **Missing database tables** - Pushed full Prisma schema to Railway PostgreSQL
6. **LIGHTNING_AUTH_URL** - Set correct public URL for LNURL callback

---

## Next Steps When Returning

1. **Google OAuth** - Once credentials are provided:
   ```bash
   cd server
   railway service link RBBP
   railway variables set GOOGLE_CLIENT_ID=xxx GOOGLE_CLIENT_SECRET=xxx
   railway redeploy
   ```

2. **Phase 2 Features** - Events, seasons, scoring, leaderboards

3. **Production Hardening**:
   - Replace MemoryStore session with Redis
   - Add rate limiting
   - Set up proper logging
