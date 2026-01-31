import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../services/auth.service';
import { UserRole } from '@prisma/client';
import '../types/express';

/**
 * Middleware to authenticate JWT token
 * Attaches user payload to request if valid
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      res.status(401).json({ error: 'Token required' });
      return;
    }

    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware to optionally authenticate
 * Attaches user if token is valid, but doesn't fail if no token
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      next();
      return;
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (token) {
      const payload = verifyToken(token);
      req.user = payload;
    }
  } catch (error) {
    // Token invalid, but that's okay for optional auth
  }
  next();
}

/**
 * Middleware to require specific role(s)
 * Must be used after authenticate middleware
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role as UserRole;
    
    if (!roles.includes(userRole)) {
      res.status(403).json({ 
        error: 'Forbidden', 
        message: `Required roles: ${roles.join(', ')}` 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Middleware to require venue manager or admin role
 */
export const requireVenueManager = requireRole(UserRole.ADMIN, UserRole.VENUE_MANAGER);

/**
 * Middleware to require tournament director, venue manager, or admin role
 */
export const requireTournamentDirector = requireRole(
  UserRole.ADMIN,
  UserRole.VENUE_MANAGER,
  UserRole.TOURNAMENT_DIRECTOR
);
