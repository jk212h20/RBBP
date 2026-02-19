import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import dotenv from 'dotenv';
import passport, { initializePassport } from './config/passport';
import authRoutes from './routes/auth.routes';
import venueRoutes from './routes/venue.routes';
import seasonRoutes from './routes/season.routes';
import eventRoutes from './routes/event.routes';
import standingsRoutes from './routes/standings.routes';
import adminRoutes from './routes/admin.routes';
import withdrawalRoutes from './routes/withdrawal.routes';
import lnurlRoutes from './routes/lnurl.routes';
import { cleanupExpiredChallenges } from './services/lightning.service';
import balanceRoutes from './routes/balance.routes';
import faqRoutes from './routes/faq.routes';
import venueApplicationRoutes from './routes/venue-application.routes';
import puzzleRoutes from './routes/puzzle.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS - allow multiple origins for development and production
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'https://rbbp.fun',
  'https://www.rbbp.fun',
  // Railway auto-generates URLs like: *.up.railway.app
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    // Allow Railway domains
    if (origin.includes('.railway.app') || origin.includes('.up.railway.app')) {
      return callback(null, true);
    }
    
    // Allow rbbp.fun domain
    if (origin.includes('rbbp.fun')) {
      return callback(null, true);
    }
    
    // Allow configured origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow localhost
    if (process.env.NODE_ENV !== 'production' && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    console.log('CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Rate limiting - General API (permissive for normal usage)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3000, // 3000 requests per 15 minutes per IP - plenty for normal usage
  message: { error: 'Too many requests, please try again later.' }
});
app.use(generalLimiter);

// Rate limiters for auth routes are defined in middleware/rateLimiter.ts
// and imported directly by auth.routes.ts

// Body parsing middleware - increased limit for base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session for passport (required even though we use JWT)
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Initialize Passport
initializePassport();
app.use(passport.initialize());

// ============================================
// HEALTH CHECK / TEST ENDPOINT
// ============================================
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Roatan Poker League API is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Info endpoint
app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({
    name: 'Roatan Poker League API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        google: 'GET /api/auth/google',
        googleCallback: 'GET /api/auth/google/callback',
        lightningChallenge: 'GET /api/auth/lightning/challenge',
        lightningCallback: 'GET /api/auth/lightning/callback',
        lightningStatus: 'GET /api/auth/lightning/status/:k1',
        me: 'GET /api/auth/me',
        logout: 'POST /api/auth/logout',
        providers: 'GET /api/auth/providers'
      },
      users: '/api/users (coming soon)',
      events: '/api/events (coming soon)',
      venues: '/api/venues (coming soon)',
      seasons: '/api/seasons (coming soon)',
      standings: '/api/standings (coming soon)'
    }
  });
});

// ============================================
// ROUTES
// ============================================

// Auth routes (rate limiters defined in middleware/rateLimiter.ts)
app.use('/api/auth', authRoutes);

// ============================================
// PLACEHOLDER ROUTES (To be implemented)
// ============================================

// Users routes placeholder
app.use('/api/users', (req: Request, res: Response) => {
  res.status(501).json({ 
    message: 'Users routes coming soon',
    availableEndpoints: ['GET /', 'GET /:id', 'PUT /:id', 'DELETE /:id']
  });
});

// Events routes
app.use('/api/events', eventRoutes);

// Venues routes
app.use('/api/venues', venueRoutes);

// Seasons routes
app.use('/api/seasons', seasonRoutes);

// Standings routes
app.use('/api/standings', standingsRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Withdrawal routes (admin API for managing withdrawals)
app.use('/api/withdrawals', withdrawalRoutes);

// LNURL routes (wallet callbacks for LNURL-withdraw protocol)
app.use('/api/lnurl', lnurlRoutes);

// Balance routes (user Lightning balance management)
app.use('/api/balance', balanceRoutes);

// FAQ routes (public + admin CRUD)
app.use('/api/faq', faqRoutes);

// Venue Application routes (submit + admin review)
app.use('/api/venue-applications', venueApplicationRoutes);

// Daily Puzzle routes (sats faucet for event attendees)
app.use('/api/puzzle', puzzleRoutes);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: ['/api', '/api/health', '/api/auth/*']
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ============================================
// BACKGROUND JOBS
// ============================================

// Clean up expired lightning challenges every 10 minutes
setInterval(() => {
  cleanupExpiredChallenges().catch(err => 
    console.error('Lightning challenge cleanup error:', err)
  );
}, 10 * 60 * 1000);

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`
  🃏 ♠️ ♥️ ♦️ ♣️ 🃏
  
  Roatan Poker League API Server
  ================================
  Status: Running
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  
  Authentication:
  - Email/Password: ✅ Enabled
  - Google OAuth: ${process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' ? '✅ Enabled' : '⚠️ Not configured'}
  - Lightning Login: ✅ Enabled
  
  Endpoints:
  - Health Check: http://localhost:${PORT}/api/health
  - API Info: http://localhost:${PORT}/api
  - Auth: http://localhost:${PORT}/api/auth/*
  
  🃏 ♠️ ♥️ ♦️ ♣️ 🃏
  `);
});

export default app;
