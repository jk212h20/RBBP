# Roatan Poker League - Project Brief

## Project Overview
A full-featured pub poker league management website for tracking tournaments, players, and standings across multiple venues in Roatan, Honduras. The app also integrates Bitcoin Lightning Network for player authentication and prize payouts.

## Live Deployment
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api
- **GitHub**: https://github.com/jk212h20/RBBP

## Core Requirements

### User Management
- User registration and authentication (email/password)
- Lightning Login (LNURL-auth) — scan QR with Bitcoin wallet
- Google OAuth (UI ready, awaiting credentials)
- Multiple user roles: Admin, Venue Manager, Tournament Director, Player
- Player profiles with statistics
- Admin notes on users (hidden from user)
- Soft-delete with full data archival (DeletedUser model)

### Event Management
- Create and manage poker tournament events (single + bulk creation)
- Player signup/registration with configurable registration open window
- Waitlist system when events are full (auto-promotion on cancellation)
- Tournament director controls for running events (status flow, check-in, results)
- Results entry with draft save and finalization
- No-show processing
- Event images (base64 upload)

### Scoring System
- Dynamic points calculation (scales with checked-in player count)
- Base pool: 10 points for ≤10 players, +2 per player beyond 10
- Distribution: 60% / 30% / 10% for top 3 places (rounded up)
- Knockout bonuses
- Manual point adjustments with audit trail (PointsHistory)
- Bulk point awards
- Season standings and leaderboards (auto-recalculated)

### Venue Management
- Multiple venue support with full CRUD
- Venue manager assignment
- Venue detail pages with event listings

### Lightning Network Integration
- **LNURL-auth**: Passwordless login via Lightning wallet
- **LNURL-withdraw**: Admin creates withdrawals, players scan QR to receive sats
- **Lightning Balance**: Per-user sat balance tracking (credit/debit/set)
- **Voltage LND**: REST API integration for node management

### Season Management
- Season creation with configurable points structures
- Season activation/deactivation
- Standings auto-recalculation
- Playoff qualification tracking

### Admin Features
- Multi-tab admin panel (Venues, Seasons, Events, Users, Withdrawals, Balance, Points)
- User role management
- Manual points adjustments with reasons
- Admin notes on users
- Lightning withdrawal management
- Balance management across all users

## Technology Stack
- **Frontend**: Next.js 16.1.6 with React 19.2.3, TypeScript, Tailwind CSS 4
- **Backend**: Node.js + Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT + bcrypt + LNURL-auth + Passport.js (Google OAuth ready)
- **Validation**: Zod schemas
- **Lightning**: Voltage LND node via REST API
- **Deployment**: Railway (client + server + PostgreSQL)
- **Email**: Nodemailer with SendGrid (dependency installed, not yet implemented)

## Target Users
1. **Players** - Poker enthusiasts in Roatan
2. **Venue Owners** - Pubs/bars hosting poker nights
3. **Tournament Directors** - People running individual events
4. **League Administrators** - Overall league management

## Success Criteria
- Easy event signup process ✅
- Real-time leaderboard updates ✅
- Mobile-responsive design ✅
- Lightning Network integration for payments ✅
- Scalable for multiple venues and seasons ✅
