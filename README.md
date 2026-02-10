# 🃏 Roatan Poker League

A full-featured pub poker league management website for Roatan, Honduras. Tracks tournaments, players, standings, and integrates Bitcoin Lightning Network for authentication and prize payouts.

**Live Site**: [client-production-41b3.up.railway.app](https://client-production-41b3.up.railway.app)

---

## Features

### ✅ Fully Implemented
- **Multi-Provider Authentication** — Email/password, Lightning Login (LNURL-auth), Google OAuth (ready, needs credentials)
- **Venue Management** — Create/manage poker venues with manager assignment
- **Season Management** — Configurable seasons with points structures
- **Event Lifecycle** — Create → Registration → Check-in → Results → Completion
- **Bulk Event Creation** — Create recurring weekly events in one action
- **Waitlist System** — Auto-promotion when spots open
- **Dynamic Scoring** — Points scale with player count (60/30/10 split + knockout bonuses)
- **Leaderboard** — Auto-calculated season standings
- **Admin Panel** — 7-tab interface (Venues, Seasons, Events, Users, Withdrawals, Balance, Points)
- **Lightning Withdrawals** — LNURL-withdraw via Voltage LND node
- **Lightning Balance** — Per-user sat balance tracking
- **Points Management** — Manual adjustments with audit trail
- **Mobile-Responsive** — Hamburger nav, touch-friendly UI
- **Event Images** — Base64 image upload

### 🔜 Not Yet Built
- Email notifications (SendGrid dependency installed)
- Achievement/badge system (schema exists)
- Event comments (schema exists)
- Password reset flow
- Test suite

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Backend | Express.js, TypeScript, Prisma ORM, Zod |
| Database | PostgreSQL |
| Auth | JWT, bcrypt, LNURL-auth, Passport.js |
| Lightning | Voltage LND (REST API) |
| Hosting | Railway |

---

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm

### Setup

```bash
# Clone
git clone https://github.com/jk212h20/RBBP.git
cd RBBP

# Server
cd server
cp .env.example .env    # Edit with your DATABASE_URL + secrets
npm install
npx prisma migrate dev  # Creates tables
npm run dev              # http://localhost:3001

# Client (new terminal)
cd client
npm install
# Create .env.local:  NEXT_PUBLIC_API_URL=http://localhost:3001/api
npm run dev              # http://localhost:3000
```

### Key Commands

```bash
# Server
npm run dev                    # Dev server with hot reload
npx prisma studio              # Database GUI
npx prisma migrate dev --name my_change  # New migration

# Client
npm run dev                    # Next.js dev server
npm run build                  # Production build
```

---

## 📁 Project Structure

```
├── client/                    # Next.js frontend
│   └── src/
│       ├── app/              # 10 pages (App Router)
│       ├── components/       # 5 reusable components
│       ├── context/          # AuthContext (JWT state)
│       └── lib/              # API client utility
│
├── server/                    # Express.js backend
│   ├── prisma/               # Schema (15 models) + 8 migrations
│   └── src/
│       ├── routes/           # 9 route files
│       ├── services/         # 10 service files (business logic)
│       ├── validators/       # 4 Zod schemas
│       ├── middleware/       # JWT auth + role checks
│       └── config/           # Passport strategies
│
├── memory-bank/               # Detailed project documentation
│   ├── projectbrief.md       # Requirements & scope
│   ├── activeContext.md      # Current state & recent changes
│   ├── progress.md           # Feature completion checklist
│   ├── systemPatterns.md     # Architecture & design patterns
│   └── techContext.md        # Tech setup & deployment guide
│
└── docs/                      # Original project plan
```

> 📖 **New to the codebase?** Start with `memory-bank/systemPatterns.md` for architecture overview, then `memory-bank/techContext.md` for setup details.

---

## 🔐 Authentication

| Method | How It Works |
|--------|-------------|
| **Email/Password** | Register → bcrypt hash → JWT (7-day) |
| **Lightning Login** | Scan QR → wallet signs challenge → JWT |
| **Google OAuth** | Redirect → Google auth → JWT (needs credentials) |

---

## 📊 API Overview

| Route | Purpose |
|-------|---------|
| `/api/auth/*` | Register, login, Lightning auth, profile |
| `/api/venues/*` | Venue CRUD, manager assignment |
| `/api/seasons/*` | Season CRUD, activation, standings |
| `/api/events/*` | Event CRUD, signup, check-in, results |
| `/api/standings/*` | Leaderboard queries |
| `/api/admin/*` | User management, points, admin notes |
| `/api/withdrawals/*` | Lightning withdrawal management |
| `/api/lnurl/*` | LNURL-withdraw protocol |
| `/api/balance/*` | Lightning balance operations |

---

## 🚀 Deploy to Railway

### Step 1: Create Railway Project
1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select this repository

### Step 2: Add PostgreSQL
1. Click **+ New** → **Database** → **PostgreSQL**

### Step 3: Deploy Server
1. **+ New** → **GitHub Repo** → Root Directory: `server`
2. Environment variables:
   ```
   DATABASE_URL        → Reference PostgreSQL's DATABASE_URL
   JWT_SECRET          → Random 32+ char string
   SESSION_SECRET      → Random 32+ char string
   CLIENT_URL          → (update after client deploys)
   NODE_ENV            → production
   ```

### Step 4: Deploy Client
1. **+ New** → **GitHub Repo** → Root Directory: `client`
2. Environment variables:
   ```
   NEXT_PUBLIC_API_URL → https://your-server.up.railway.app/api
   ```

### Step 5: Update CLIENT_URL
Set the server's `CLIENT_URL` to your client's Railway URL.

### Optional: Lightning Network
```
VOLTAGE_REST_HOST   → https://your-node.voltage.cloud:8080
VOLTAGE_MACAROON    → admin macaroon (hex encoded)
LNURL_BASE_URL      → https://your-server.up.railway.app/api
LIGHTNING_AUTH_URL   → https://your-server.up.railway.app/api/auth/lightning
```

### Optional: Google OAuth
```
GOOGLE_CLIENT_ID     → From Google Cloud Console
GOOGLE_CLIENT_SECRET → From Google Cloud Console
GOOGLE_CALLBACK_URL  → https://your-server.up.railway.app/api/auth/google/callback
```

---

## 📝 Environment Variables Reference

### Server (`server/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | JWT signing secret |
| `SESSION_SECRET` | ✅ | Express session secret |
| `CLIENT_URL` | ✅ | Frontend URL (CORS) |
| `PORT` | ❌ | Server port (default: 3001) |
| `NODE_ENV` | ❌ | development / production |
| `VOLTAGE_REST_HOST` | ❌ | Voltage LND REST URL |
| `VOLTAGE_MACAROON` | ❌ | Voltage admin macaroon (hex) |
| `LNURL_BASE_URL` | ❌ | Public API URL for LNURL callbacks |
| `LIGHTNING_AUTH_URL` | ❌ | Lightning auth base URL |
| `GOOGLE_CLIENT_ID` | ❌ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ❌ | Google OAuth secret |
| `GOOGLE_CALLBACK_URL` | ❌ | Google OAuth callback URL |
| `SENDGRID_API_KEY` | ❌ | SendGrid key (not yet used) |

### Client (`client/.env.local`)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL |

---

## License

ISC
