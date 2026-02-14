import rateLimit from 'express-rate-limit';

// Failed login protection - only counts failed attempts (brute force protection)
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 6, // 6 failed attempts before lockout
  skipSuccessfulRequests: true, // Only count failures!
  message: { error: 'Too many failed login attempts. Please try again in 15 minutes.' }
});

// Lightning challenge generation limiter
export const lightningChallengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 challenge generations per 15 minutes
  message: { error: 'Too many login attempts. Please try again later.' }
});
