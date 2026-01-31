import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { findOrCreateGoogleUser } from '../services/auth.service';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

// Extended result type for our auth flow
interface GoogleAuthResult {
  user: any;
  token: string;
  isNew: boolean;
}

export function initializePassport() {
  // Only configure Google strategy if credentials are provided
  if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && 
      GOOGLE_CLIENT_ID !== 'your-google-client-id') {
    
    passport.use(
      new GoogleStrategy(
        {
          clientID: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          callbackURL: GOOGLE_CALLBACK_URL,
          scope: ['profile', 'email'],
        },
        async (
          accessToken: string, 
          refreshToken: string, 
          profile: Profile, 
          done: VerifyCallback
        ) => {
          try {
            const email = profile.emails?.[0]?.value || '';
            const avatar = profile.photos?.[0]?.value;

            const result = await findOrCreateGoogleUser({
              id: profile.id,
              email,
              name: profile.displayName || email.split('@')[0],
              avatar,
            });

            // Pass result as the user object (we handle it in the callback route)
            done(null, result as any);
          } catch (error) {
            done(error as Error);
          }
        }
      )
    );

    console.log('✅ Google OAuth configured');
  } else {
    console.log('⚠️ Google OAuth not configured (missing credentials)');
  }

  // Serialize user for session (we don't use sessions, but passport needs this)
  passport.serializeUser((user: Express.User, done) => {
    done(null, user);
  });

  passport.deserializeUser((user: Express.User, done) => {
    done(null, user);
  });
}

export function isGoogleConfigured(): boolean {
  return !!(
    GOOGLE_CLIENT_ID && 
    GOOGLE_CLIENT_SECRET && 
    GOOGLE_CLIENT_ID !== 'your-google-client-id'
  );
}

export default passport;
