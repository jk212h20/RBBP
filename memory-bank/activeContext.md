# Roatan Poker League - Active Context

## Current Focus
Building the authentication system with multiple providers.

## Recent Changes

### Authentication System Implemented (Jan 31, 2026)
Added complete multi-provider authentication:

1. **Email/Password Authentication**
   - Registration with validation (Zod)
   - Login with JWT tokens
   - Password hashing with bcrypt (12 rounds)

2. **Google OAuth**
   - Passport.js with Google Strategy
   - Automatic account linking by email
   - Redirect flow to frontend callback

3. **Lightning Login (LNURL-auth)**
   - QR code generation for wallet scanning
   - LNURL-auth spec compliant
   - Polling endpoint for frontend
   - secp256k1 signature verification

### Files Created
```
server/src/
├── config/
│   └── passport.ts         # Google OAuth configuration
├── lib/
│   └── prisma.ts          # Prisma client singleton
├── middleware/
│   └── auth.middleware.ts  # JWT auth middleware
├── routes/
│   └── auth.routes.ts     # All auth endpoints
├── services/
│   ├── auth.service.ts    # JWT, passwords, user creation
│   └── lightning.service.ts # LNURL-auth implementation
├── types/
│   └── express.d.ts       # Express type extensions
└── validators/
    └── auth.validator.ts  # Zod validation schemas
```

### Database Schema Updates
- Added `AuthProvider` enum (EMAIL, GOOGLE, LIGHTNING)
- Added `googleId` and `lightningPubkey` to User model
- Made `email` and `password` optional for social logins
- Added `LightningChallenge` model for LNURL-auth

## Next Steps
1. **Database Migration** - Need PostgreSQL running to migrate
2. **Test Auth Endpoints** - Verify all routes work
3. **Frontend Setup** - Create Next.js client
4. **Build CRUD Routes** - Events, Venues, Seasons, etc.

## API Endpoints Available

### Auth Routes (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Email/password signup |
| POST | `/login` | Email/password login |
| GET | `/google` | Start Google OAuth |
| GET | `/google/callback` | Google OAuth callback |
| GET | `/lightning/challenge` | Get LNURL-auth QR code |
| GET | `/lightning/callback` | Lightning wallet callback |
| GET | `/lightning/status/:k1` | Poll auth status |
| GET | `/me` | Get current user (auth required) |
| POST | `/logout` | Logout |
| GET | `/providers` | List available auth methods |

## Environment Variables Required
```env
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret

# For Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Optional
CLIENT_URL=http://localhost:3000
SESSION_SECRET=your-session-secret
```

## Important Patterns
- JWT tokens expire in 7 days (configurable)
- Google OAuth auto-links accounts by email
- Lightning auth creates users with pubkey as identifier
- All passwords hashed with bcrypt (12 rounds)
