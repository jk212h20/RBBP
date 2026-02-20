import { Router, Request, Response } from 'express';
import passport from 'passport';
import QRCode from 'qrcode';
import {
  register, 
  login, 
  getUserById, 
  findOrCreateLightningUser,
  updateProfile,
  updateProfileDetails,
  getProfileDetails,
  getPublicPlayerProfile,
  linkLightningToAccount,
  addEmailToAccount,
  validateClaimToken,
  claimGuestAccount
} from '../services/auth.service';
import { 
  createChallenge, 
  verifyChallenge, 
  getChallengeStatus 
} from '../services/lightning.service';
import { authenticate } from '../middleware/auth.middleware';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/auth.validator';
import { isGoogleConfigured } from '../config/passport';
import { loginLimiter, lightningChallengeLimiter, lightningStatusLimiter } from '../middleware/rateLimiter';
import { verifyTelegramUsername } from '../services/telegram.service';

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
 * Rate limited: 6 failed attempts per 15 minutes per IP
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
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
 * Rate limited: 20 challenges per 15 minutes per IP
 */
router.get('/lightning/challenge', lightningChallengeLimiter, async (req: Request, res: Response) => {
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

    // Validate hex format: k1 must be 64 hex chars, key must be 66 hex chars (compressed pubkey), sig is variable-length DER
    const hexRegex = /^[0-9a-f]+$/i;
    if (
      typeof k1 !== 'string' || k1.length !== 64 || !hexRegex.test(k1) ||
      typeof key !== 'string' || (key.length !== 66 && key.length !== 130) || !hexRegex.test(key) ||
      typeof sig !== 'string' || sig.length < 8 || sig.length > 144 || !hexRegex.test(sig)
    ) {
      res.json({ status: 'ERROR', reason: 'Invalid parameter format' });
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
router.get('/lightning/status/:k1', lightningStatusLimiter, async (req: Request, res: Response) => {
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
    try {
      const pubkey = status.pubkey;
      if (!pubkey) {
        console.error('Lightning status - verified but no pubkey! status:', JSON.stringify(status));
        res.status(500).json({ error: 'Verified but no pubkey found' });
        return;
      }
      console.log(`Lightning status - verified, finding/creating user for pubkey: ${pubkey.substring(0, 16)}...`);
      const result = await findOrCreateLightningUser(pubkey);
      console.log(`Lightning status - user found/created: ${result.user.id}, isNew: ${result.isNew}`);

      res.json({
        status: 'verified',
        token: result.token,
        user: result.user,
        isNew: result.isNew,
        lightningBonusAwarded: result.lightningBonusAwarded,
      });
    } catch (userError: any) {
      console.error('Lightning status - findOrCreateLightningUser error:', userError?.message || userError);
      console.error('Lightning status - full error:', JSON.stringify(userError, Object.getOwnPropertyNames(userError)));
      console.error('Lightning status - pubkey was:', status.pubkey);
      res.status(500).json({ error: 'Failed to create/find user after verification', detail: userError?.message });
    }
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
 * GET /api/auth/profile/details
 * Get profile details (bio, profileImage)
 */
router.get('/profile/details', authenticate, async (req: Request, res: Response) => {
  try {
    const profile = await getProfileDetails(req.user!.userId);
    res.json({ profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get profile details';
    res.status(400).json({ error: message });
  }
});

/**
 * PUT /api/auth/profile/details
 * Update profile details (bio, profileImage, socialLinks, visibility)
 */
router.put('/profile/details', authenticate, async (req: Request, res: Response) => {
  try {
    const { bio, profileImage, telegramUsername, telegramVisibility, nostrPubkey, nostrVisibility, socialLinks, socialLinksVisibility } = req.body;

    // Validate profileImage size (max ~500KB base64 string)
    if (profileImage && profileImage.length > 700000) {
      res.status(400).json({ error: 'Profile image is too large. Please use an image under 500KB.' });
      return;
    }

    // Validate bio length
    if (bio && bio.length > 500) {
      res.status(400).json({ error: 'Bio must be 500 characters or less.' });
      return;
    }

    // Validate telegramUsername length
    if (telegramUsername && typeof telegramUsername === 'string' && telegramUsername.length > 50) {
      res.status(400).json({ error: 'Telegram username must be 50 characters or less.' });
      return;
    }

    // Validate socialLinks - must be an object with string values (URLs)
    if (socialLinks !== undefined && socialLinks !== null) {
      if (typeof socialLinks !== 'object' || Array.isArray(socialLinks)) {
        res.status(400).json({ error: 'Social links must be an object.' });
        return;
      }
      // Validate each link is a string and reasonable length
      for (const [key, value] of Object.entries(socialLinks)) {
        if (typeof value !== 'string' || (value as string).length > 500) {
          res.status(400).json({ error: `Invalid social link for ${key}.` });
          return;
        }
      }
    }

    const profile = await updateProfileDetails(req.user!.userId, {
      bio,
      profileImage,
      telegramUsername,
      ...(telegramVisibility && { telegramVisibility }),
      ...(nostrPubkey !== undefined && { nostrPubkey }),
      ...(nostrVisibility && { nostrVisibility }),
      socialLinks,
      ...(socialLinksVisibility && { socialLinksVisibility }),
    });
    res.json({ message: 'Profile details updated', profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile details';
    res.status(400).json({ error: message });
  }
});

// ============================================
// PUBLIC PLAYER PROFILES
// ============================================

/**
 * GET /api/auth/players/:id
 * Get public player profile. Auth optional — admins see hidden fields.
 */
router.get('/players/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Optionally authenticate to determine admin status
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const { verifyToken } = await import('../services/auth.service');
        const payload = verifyToken(authHeader.slice(7));
        isAdmin = payload.role === 'ADMIN';
      } catch {
        // Invalid token — treat as unauthenticated
      }
    }

    const profile = await getPublicPlayerProfile(id, isAdmin);
    
    if (!profile) {
      res.status(404).json({ error: 'Player not found' });
      return;
    }

    res.json({ player: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get player profile';
    res.status(500).json({ error: message });
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

// ============================================
// LINK LIGHTNING WALLET TO EXISTING ACCOUNT
// ============================================

/**
 * GET /api/auth/link-lightning/challenge
 * Get a challenge to link Lightning wallet to current account
 * Rate limited: 20 challenges per 15 minutes per IP
 */
router.get('/link-lightning/challenge', authenticate, lightningChallengeLimiter, async (req: Request, res: Response) => {
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
    console.error('Link lightning challenge error:', error);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

/**
 * GET /api/auth/link-lightning/status/:k1
 * Check if challenge is verified and link to current account
 */
router.get('/link-lightning/status/:k1', authenticate, lightningStatusLimiter, async (req: Request, res: Response) => {
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

    // Challenge is verified, link pubkey to current user
    const result = await linkLightningToAccount(req.user!.userId, status.pubkey!);

    res.json({
      status: 'linked',
      user: result.user,
      token: result.token,
      lightningBonusAwarded: result.lightningBonusAwarded,
    });
  } catch (error) {
    console.error('Link lightning status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to link Lightning wallet';
    res.status(400).json({ error: message });
  }
});

// ============================================
// ADD EMAIL/PASSWORD TO EXISTING ACCOUNT
// ============================================

/**
 * POST /api/auth/add-email
 * Add email and password to current account (for Lightning users)
 */
router.post('/add-email', authenticate, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const result = await addEmailToAccount(req.user!.userId, email, password);

    res.json({
      message: 'Email added successfully',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add email';
    res.status(400).json({ error: message });
  }
});

// ============================================
// TELEGRAM VERIFICATION
// ============================================

/**
 * POST /api/auth/telegram/verify
 * Send a test DM to the user's saved telegramUsername to verify they've started the bot.
 * On success, sets telegramVerified=true on their profile.
 */
router.post('/telegram/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const profile = await import('../services/auth.service').then(m => m.getProfileDetails(req.user!.userId));
    
    if (!profile.telegramUsername) {
      res.status(400).json({ error: 'No Telegram username set. Please save your username first.' });
      return;
    }

    const result = await verifyTelegramUsername(req.user!.userId, profile.telegramUsername);

    if (result.success) {
      res.json({ success: true, message: 'Verification message sent! Check your Telegram.' });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification failed';
    res.status(500).json({ error: message });
  }
});

// ============================================
// GUEST ACCOUNT CLAIM
// ============================================

/**
 * GET /api/auth/claim/:token
 * Validate a claim token and return guest info
 */
router.get('/claim/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const result = await validateClaimToken(token);
    
    res.json({
      valid: true,
      guestName: result.guestName,
      guestId: result.guestId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid claim token';
    res.status(400).json({ valid: false, error: message });
  }
});

/**
 * POST /api/auth/claim/:token
 * Claim a guest account by setting email and password
 */
router.post('/claim/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const result = await claimGuestAccount(token, email, password, name);

    res.json({
      message: 'Account claimed successfully! You can now log in.',
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to claim account';
    res.status(400).json({ error: message });
  }
});

export default router;
