# 🃏 Roatan Poker League

A full-featured pub poker league management website with multi-provider authentication.

## Features

- **Multi-Provider Authentication**
  - ✉️ Email/Password with JWT
  - 🔵 Google OAuth
  - ⚡ Lightning Login (Bitcoin Lightning Network)

- **Poker League Management** (Coming Soon)
  - Tournament events and signups
  - Points-based leaderboards
  - Season management
  - Venue tracking
  - Player profiles

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Express.js, TypeScript, Prisma ORM
- **Database**: PostgreSQL
- **Authentication**: JWT, Passport.js, LNURL-auth

---

## 🚀 Deploy to Railway

### Step 1: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select this repository: `jk212h20/RBBP`

### Step 2: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically create and configure the database

### Step 3: Deploy the Server

1. Click **"+ New"** → **"GitHub Repo"**
2. Select the repo again
3. In the service settings:
   - **Root Directory**: `server`
   - **Name**: `server`
4. Add these **Environment Variables**:
   ```
   DATABASE_URL        → Click "Reference" → Select your PostgreSQL's DATABASE_URL
   JWT_SECRET          → Generate a secure random string (32+ chars)
   SESSION_SECRET      → Generate another secure random string
   CLIENT_URL          → Leave empty for now (update after deploying client)
   NODE_ENV            → production
   ```

### Step 4: Deploy the Client

1. Click **"+ New"** → **"GitHub Repo"**
2. Select the repo again
3. In the service settings:
   - **Root Directory**: `client`
   - **Name**: `client`
4. Add these **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL → Copy your server's URL + "/api" 
                         (e.g., https://server-production-xxxx.up.railway.app/api)
   ```

### Step 5: Update Server's CLIENT_URL

1. Go back to your **server** service
2. Add/update the `CLIENT_URL` environment variable with your client's URL
   (e.g., `https://client-production-xxxx.up.railway.app`)

### Step 6: Configure Google OAuth (Optional)

If you want Google login:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add these redirect URIs:
   - `https://your-server-url.railway.app/api/auth/google/callback`
4. Add to server environment variables:
   ```
   GOOGLE_CLIENT_ID     → Your Google Client ID
   GOOGLE_CLIENT_SECRET → Your Google Client Secret
   GOOGLE_CALLBACK_URL  → https://your-server-url.railway.app/api/auth/google/callback
   ```

---

## 🔧 Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/jk212h20/RBBP.git
   cd RBBP
   ```

2. **Setup Server**
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your database URL and secrets
   npm install
   npx prisma migrate dev
   npm run dev
   ```

3. **Setup Client**
   ```bash
   cd client
   npm install
   npm run dev
   ```

4. **Open in browser**
   - Client: http://localhost:3000
   - Server: http://localhost:3001/api

---

## 📁 Project Structure

```
.
├── client/                 # Next.js frontend
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── context/       # React context (Auth)
│   │   └── lib/           # API utilities
│   └── railway.toml       # Railway deploy config
│
├── server/                 # Express.js backend
│   ├── src/
│   │   ├── config/        # Passport configuration
│   │   ├── middleware/    # Auth middleware
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   └── validators/    # Zod schemas
│   ├── prisma/            # Database schema
│   └── railway.toml       # Railway deploy config
│
└── memory-bank/           # Project documentation
```

---

## 🔐 Authentication Methods

### Email/Password
- Register with email, password, and name
- Login returns JWT token (7-day expiry)
- Passwords hashed with bcrypt

### Google OAuth
- Click "Sign in with Google" button
- Redirects to Google for authentication
- Auto-links existing accounts by email

### Lightning Login (⚡)
- Click Lightning tab, scan QR with wallet
- Compatible wallets: Phoenix, Wallet of Satoshi, Zeus, BlueWallet
- No password needed - cryptographic authentication

---

## 📝 Environment Variables

### Server
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `SESSION_SECRET` | Secret for express-session |
| `CLIENT_URL` | Frontend URL for CORS |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `GOOGLE_CALLBACK_URL` | Google OAuth callback URL |
| `LIGHTNING_AUTH_URL` | Base URL for Lightning auth |

### Client
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL |

---

## License

ISC
