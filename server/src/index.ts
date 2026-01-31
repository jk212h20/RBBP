import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import dotenv from 'dotenv';
import passport, { initializePassport } from './config/passport';
import authRoutes from './routes/auth.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Auth routes
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

// Events routes placeholder
app.use('/api/events', (req: Request, res: Response) => {
  res.status(501).json({ 
    message: 'Events routes coming soon',
    availableEndpoints: ['GET /', 'GET /:id', 'POST /', 'PUT /:id', 'DELETE /:id', 'POST /:id/signup']
  });
});

// Venues routes placeholder
app.use('/api/venues', (req: Request, res: Response) => {
  res.status(501).json({ 
    message: 'Venues routes coming soon',
    availableEndpoints: ['GET /', 'GET /:id', 'POST /', 'PUT /:id', 'DELETE /:id']
  });
});

// Seasons routes placeholder
app.use('/api/seasons', (req: Request, res: Response) => {
  res.status(501).json({ 
    message: 'Seasons routes coming soon',
    availableEndpoints: ['GET /', 'GET /:id', 'POST /', 'PUT /:id', 'GET /:id/standings']
  });
});

// Standings routes placeholder
app.use('/api/standings', (req: Request, res: Response) => {
  res.status(501).json({ 
    message: 'Standings routes coming soon',
    availableEndpoints: ['GET /current', 'GET /season/:seasonId', 'GET /player/:playerId']
  });
});

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
