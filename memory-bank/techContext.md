# Tech Context — Roatan Poker League

## Last Updated: February 10, 2026

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 16.1.6 | React framework with App Router |
| React | 19.2.3 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first CSS |
| PostCSS | 8.x | CSS processing |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 18+ | Runtime |
| Express.js | 4.x | HTTP framework |
| TypeScript | 5.x | Type safety |
| Prisma | 6.x | ORM / database client |
| Zod | 3.x | Input validation |
| jsonwebtoken | 9.x | JWT token generation/verification |
| bcryptjs | 2.x | Password hashing |
| passport | 0.7.x | Authentication strategies |
| passport-google-oauth20 | 2.x | Google OAuth strategy |
| cors | 2.x | Cross-origin resource sharing |
| express-session | 1.x | Session management |
| nodemailer | 6.x | Email sending (not yet used) |

### Database
| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 15+ | Primary database |
| Prisma ORM | 6.x | Schema management, migrations, queries |

### External Services
| Service | Purpose | Status |
|---------|---------|--------|
| Railway | Hosting (client + server + PostgreSQL) | ✅ Active |
| Voltage | Lightning Network node (LND) | ✅ Configured |
| Google Cloud | OAuth provider | ❌ Needs credentials |
| SendGrid | Email delivery | ❌ Not yet implemented |

---

## Development Setup

### Prerequisites
- **Node.js** 18+ (recommended: use nvm)
- **PostgreSQL** running locally (or use a cloud instance)
- **npm** (comes with Node.js)
- **Git**

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/jk212h20/RBBP.git
cd RBBP

# 2. Setup the server
cd server
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL to your PostgreSQL instance
npm install
npx prisma migrate dev    # Creates tables + generates client
npm run dev                # Starts server on http://localhost:3001

# 3. Setup the client (new terminal)
cd client
npm install
# Create .env.local with:
#   NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm run dev                # Starts client on http://localhost:3000
```

### Server Environment Variables

Create `server/.env` from `server/.env.example`:

```env
# Required
DATABASE_URL="postgresql://postgres:password@localhost:5432/roatan_poker?schema=public"
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SESSION_SECRET=your-session-secret-change-in-production
CLIENT_URL=http://localhost:3000

# Optional
PORT=3001
NODE_ENV=development
JWT_EXPIRES_IN=7d

# Google OAuth (optional — login tab hidden without these)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Lightning Auth (optional — Lightning login tab hidden without this)
LIGHTNING_AUTH_URL=http://localhost:3001/api/auth/lightning

# Voltage LND (optional — withdrawal features disabled without these)
VOLTAGE_REST_HOST=https://your-node.voltage.cloud:8080
VOLTAGE_MACAROON=your-admin-macaroon-hex-encoded
LNURL_BASE_URL=http://localhost:3001/api

# Email (optional — not yet implemented)
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@roatanpoker.com
```

### Client Environment Variables

Create `client/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Common Development Commands

```bash
# Server
cd server
npm run dev              # Start dev server with hot reload (ts-node-dev)
npm run build            # Compile TypeScript to dist/
npm start                # Run compiled server (production)
npx prisma studio        # Open Prisma database GUI
npx prisma migrate dev   # Create + apply new migration
npx prisma generate      # Regenerate Prisma client after schema changes
npx prisma db push       # Push schema changes without migration (dev only)

# Client
cd client
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm start                # Start production server
npm run lint             # Run ESLint
```

---

## Project Structure

```
RoatanPoker/
├── .gitignore
├── README.md
├── docs/
│   └── RoatanPoker-Project-Plan.html    # Original project plan document
├── memory-bank/                          # Project documentation (for AI/developer context)
│   ├── projectbrief.md                   # Project overview and requirements
│   ├── activeContext.md                  # Current state and recent changes
│   ├── progress.md                       # Feature completion tracking
│   ├── systemPatterns.md                 # Architecture and design patterns
│   ├── techContext.md                    # This file — tech setup guide
│   └── productContext.md                 # (if created) User experience goals
│
├── client/                               # Next.js frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   ├── eslint.config.mjs
│   ├── nixpacks.toml                    # Railway build config
│   ├── railway.toml                     # Railway deploy config
│   ├── public/                          # Static assets
│   └── src/
│       ├── app/                         # Next.js App Router pages
│       │   ├── layout.tsx               # Root layout (AuthProvider, nav, footer)
│       │   ├── globals.css              # Global styles (Tailwind)
│       │   ├── page.tsx                 # Home page
│       │   ├── login/page.tsx           # Login (email + Lightning tabs)
│       │   ├── register/page.tsx        # Registration form
│       │   ├── dashboard/page.tsx       # Player dashboard
│       │   ├── events/page.tsx          # Event listing
│       │   ├── events/[id]/page.tsx     # Event detail + TD controls
│       │   ├── leaderboard/page.tsx     # Season standings
│       │   ├── profile/page.tsx         # User profile management
│       │   ├── admin/page.tsx           # Admin panel (multi-tab)
│       │   ├── venues/page.tsx          # Venue listing
│       │   ├── venues/[id]/page.tsx     # Venue detail
│       │   └── auth/callback/page.tsx   # Google OAuth callback
│       ├── components/
│       │   ├── MobileNav.tsx            # Hamburger menu for mobile
│       │   ├── ImageUpload.tsx          # Base64 image upload
│       │   ├── BalanceTab.tsx           # Admin: balance management
│       │   ├── WithdrawalsTab.tsx       # Admin: withdrawal management
│       │   └── PointsTab.tsx            # Admin: points management
│       ├── context/
│       │   └── AuthContext.tsx           # Auth state (user, token, login/logout)
│       └── lib/
│           └── api.ts                   # Centralized fetch wrapper
│
└── server/                               # Express.js backend
    ├── package.json
    ├── tsconfig.json
    ├── nixpacks.toml                    # Railway build config
    ├── railway.toml                     # Railway deploy config
    ├── prisma/
    │   ├── schema.prisma                # Database schema (15 models)
    │   └── migrations/                  # 8 SQL migration files
    └── src/
        ├── index.ts                     # Express app entry point
        ├── config/
        │   └── passport.ts              # Passport strategies (Google, Lightning)
        ├── lib/
        │   └── prisma.ts               # Prisma client singleton
        ├── middleware/
        │   └── auth.middleware.ts        # JWT auth + role-based access
        ├── routes/
        │   ├── auth.routes.ts           # /api/auth/*
        │   ├── venue.routes.ts          # /api/venues/*
        │   ├── season.routes.ts         # /api/seasons/*
        │   ├── event.routes.ts          # /api/events/*
        │   ├── standings.routes.ts      # /api/standings/*
        │   ├── admin.routes.ts          # /api/admin/*
        │   ├── withdrawal.routes.ts     # /api/withdrawals/*
        │   ├── lnurl.routes.ts          # /api/lnurl/*
        │   └── balance.routes.ts        # /api/balance/*
        ├── services/
        │   ├── auth.service.ts          # User auth, registration, profile
        │   ├── event.service.ts         # Event lifecycle, signups, results
        │   ├── season.service.ts        # Season CRUD, activation
        │   ├── venue.service.ts         # Venue CRUD, manager assignment
        │   ├── standings.service.ts     # Leaderboard calculations
        │   ├── points.service.ts        # Manual point adjustments
        │   ├── balance.service.ts       # Lightning balance operations
        │   ├── withdrawal.service.ts    # LNURL-withdraw flow
        │   ├── lightning.service.ts     # LNURL-auth challenge/verify
        │   └── voltage.service.ts       # LND REST API client
        ├── validators/
        │   ├── auth.validator.ts        # Register, Login, UpdateProfile schemas
        │   ├── event.validator.ts       # CreateEvent, UpdateEvent, BulkCreate, Result schemas
        │   ├── season.validator.ts      # CreateSeason, UpdateSeason schemas
        │   └── venue.validator.ts       # CreateVenue, UpdateVenue schemas
        └── types/
            └── express.d.ts             # Express Request type augmentation
```

---

## Deployment (Railway)

### Current Production URLs
- **Frontend**: https://client-production-41b3.up.railway.app
- **Backend API**: https://rbbp-production.up.railway.app/api

### Railway Services
1. **PostgreSQL** — Managed database (auto-provisioned)
2. **server** — Express API (root directory: `server`)
3. **client** — Next.js app (root directory: `client`)

### Deploy Process
1. Push to `main` branch on GitHub
2. Railway auto-detects changes and rebuilds affected services
3. Server build: `prisma generate` → `prisma migrate deploy` → `tsc` → `node dist/index.js`
4. Client build: `next build` → `next start`

### Adding a New Migration
```bash
cd server
# 1. Edit prisma/schema.prisma
# 2. Generate migration
npx prisma migrate dev --name describe_your_change
# 3. Commit the migration file
git add prisma/
git commit -m "Add migration: describe your change"
git push
# Railway will auto-apply on deploy
```

---

## Technical Constraints & Notes

1. **No test suite** — No unit or integration tests exist yet. Adding Jest + Supertest for the server and React Testing Library for the client would be valuable.

2. **MemoryStore for sessions** — Express sessions use the default MemoryStore. This is fine for a single Railway instance but would need Redis for horizontal scaling.

3. **Base64 images** — Event images are stored as base64 strings in the database. For production scale, consider migrating to S3/Cloudflare R2 with URL references.

4. **No rate limiting** — API endpoints don't have rate limiting. Consider adding `express-rate-limit` for production hardening.

5. **No HTTPS enforcement** — Railway handles TLS termination, but the Express app doesn't enforce HTTPS redirects.

6. **Lightning challenges in DB** — LNURL-auth challenges are stored in the LightningChallenge table with expiry. A cleanup function exists but needs to be called periodically (cron or on-request).

7. **Single active season** — The system enforces only one active season at a time. Activating a new season deactivates the current one.

8. **Tailwind CSS 4** — Uses the latest Tailwind with the new engine. CSS is in `globals.css` with `@import "tailwindcss"`.
