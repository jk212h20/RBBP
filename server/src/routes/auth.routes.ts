import { Router, Request, Response } from 'express';
import passport from 'passport';
import QRCode from 'qrcode';
import {
  register, 
  login, 
  getUserById, 
  findOrCreateLightningUser,
  updateProfile
} from '../services/auth.service';
import { 
  createChallenge, 
  verifyChallenge, 
  getChallengeStatus 
} from '../services/lightning.service';
import { authenticate } from '../middleware/auth.middleware';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/auth.validator';
import { isGoogleConfigured } from '../config/passport';

const router = Router();

// ============================================
// EMAIL/PASSWORD AUTHENTICATION
// ============================================

/**
 * POST /api/auth/register
 * Register a new user with email and password
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validation = registerSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
      return;
    }

    const result = await register(validation.data);
    
    res.status(201).json({
      message: 'Registration successful',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    res.status(400).json({ error: message });
  }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validation = loginSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
      return;
    }

    const result = await login(validation.data);
    
    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    res.status(401).json({ error: message });
  }
});

// ============================================
// GOOGLE OAUTH
// ============================================

/**
 * GET /api/auth/google
 * Start Google OAuth flow
 */
router.get('/google', (req: Request, res: Response, next) => {
  if (!isGoogleConfigured()) {
    res.status(501).json({ 
      error: 'Google OAuth not configured',
      message: 'Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env'
    });
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

/**
 * GET /api/auth/google/callback
 * Google OAuth callback
 */
router.get('/google/callback', (req: Request, res: Response, next) => {
  if (!isGoogleConfigured()) {
    res.status(501).json({ error: 'Google OAuth not configured' });
    return;
  }
  
  passport.authenticate('google', { session: false }, (err: any, result: any) => {
    if (err || !result) {
      // Redirect to frontend with error
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
      res.redirect(`${clientUrl}/auth/callback?error=${encodeURIComponent(err?.message || 'Authentication failed')}`);
      return;
    }

    // Redirect to frontend with token
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${clientUrl}/auth/callback?token=${result.token}&isNew=${result.isNew}`);
  })(req, res, next);
});

// ============================================
// LIGHTNING AUTHENTICATION (LNURL-AUTH)
// ============================================

/**
 * GET /api/auth/lightning/challenge
 * Get a new LNURL-auth challenge
 */
router.get('/lightning/challenge', async (req: Request, res: Response) => {
  try {
    const challenge = await createChallenge();
    
    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(challenge.lnurl.toUpperCase(), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 256,
    });

    res.json({
      k1: challenge.k1,
      lnurl: challenge.lnurl,
      qrCode: qrCodeDataUrl,
      expiresIn: 300, // 5 minutes
    });
  } catch (error) {
    console.error('Lightning challenge error:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

/**
 * GET /api/auth/lightning/callback
 * LNURL-auth callback (called by Lightning wallet)
 * According to LNURL spec, this must return JSON with status
 */
router.get('/lightning/callback', async (req: Request, res: Response) => {
  try {
    const { tag, k1, sig, key } = req.query;

    // Validate required parameters
    if (tag !== 'login') {
      res.json({ status: 'ERROR', reason: 'Invalid tag' });
      return;
    }

    if (!k1 || !sig || !key) {
      res.json({ status: 'ERROR', reason: 'Missing parameters' });
      return;
    }

    // Verify the signature
    const result = await verifyChallenge(
      k1 as string,
      sig as string,
      key as string
    );

    if (!result.success) {
      res.json({ status: 'ERROR', reason: result.error || 'Verification failed' });
      return;
    }

    // Return success (wallet expects this)
    res.json({ status: 'OK' });
  } catch (error) {
    console.error('Lightning callback error:', error);
    res.json({ status: 'ERROR', reason: 'Server error' });
  }
});

/**
 * GET /api/auth/lightning/status/:k1
 * Check if a challenge has been verified (poll from frontend)
 */
router.get('/lightning/status/:k1', async (req: Request, res: Response) => {
  try {
    const { k1 } = req.params;
    const status = await getChallengeStatus(k1);

    if (status.expired && !status.verified) {
      res.json({ status: 'expired' });
      return;
    }

    if (!status.verified) {
      res.json({ status: 'pending' });
      return;
    }

    // Challenge is verified, create/find user and return token
    const result = await findOrCreateLightningUser(status.pubkey!);

    res.json({
      status: 'verified',
      token: result.token,
      user: result.user,
      isNew: result.isNew,
    });
  } catch (error) {
    console.error('Lightning status error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

// ============================================
// USER PROFILE
// ============================================

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.user!.userId);
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client should discard token)
 */
router.post('/logout', authenticate, (req: Request, res: Response) => {
  // With JWT, logout is handled client-side by discarding the token
  // This endpoint exists for API consistency and potential future token blacklisting
  res.json({ message: 'Logged out successfully' });
});

/**
 * PUT /api/auth/profile
 * Update user profile (name, email)
 */
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const validation = updateProfileSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
      return;
    }

    const result = await updateProfile(req.user!.userId, validation.data);
    
    res.json({
      message: 'Profile updated successfully',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    res.status(400).json({ error: message });
  }
});

/**
 * GET /api/auth/providers
 * Get available authentication providers
 */
router.get('/providers', (req: Request, res: Response) => {
  res.json({
    providers: {
      email: true,
      google: isGoogleConfigured(),
      lightning: true,
    },
  });
});

export default router;
