import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, AuthProvider } from '@prisma/client';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { awardLightningBonusPoint } from './standings.service';
import { notifyNewUser } from './telegram.service';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Types
export interface JwtPayload {
  userId: string;
  email: string | null;
  role: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  telegramUsername?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

// ============================================
// PASSWORD FUNCTIONS
// ============================================

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// ============================================
// JWT FUNCTIONS
// ============================================

export function generateToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as string,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

// ============================================
// USER FUNCTIONS
// ============================================

export async function register(input: RegisterInput) {
  const { email, password, name, telegramUsername } = input;

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Hash password and create user
  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      authProvider: AuthProvider.EMAIL,
    },
  });

  // Create profile (with telegram if provided)
  await prisma.profile.create({
    data: {
      userId: user.id,
      ...(telegramUsername && { telegramUsername }),
    },
  });

  // Fire Telegram notification (non-blocking)
  notifyNewUser({ name, email, telegramUsername, authProvider: 'EMAIL' }).catch(() => {});

  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function login(input: LoginInput) {
  const { email, password } = input;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.password) {
    throw new Error('This account uses social login. Please sign in with Google or Lightning.');
  }

  const isValid = await verifyPassword(password, user.password);

  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  const token = generateToken(user);

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function findOrCreateGoogleUser(profile: {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}) {
  // Check if user exists by Google ID
  let user = await prisma.user.findUnique({
    where: { googleId: profile.id },
  });

  if (user) {
    return { user: sanitizeUser(user), token: generateToken(user), isNew: false };
  }

  // Check if email already exists (link accounts)
  if (profile.email) {
    user = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      // Link Google account to existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.id, avatar: profile.avatar || user.avatar },
      });
      return { user: sanitizeUser(user), token: generateToken(user), isNew: false };
    }
  }

  // Create new user
  user = await prisma.user.create({
    data: {
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
      avatar: profile.avatar,
      authProvider: AuthProvider.GOOGLE,
      emailVerified: true, // Google emails are verified
    },
  });

  // Create profile
  await prisma.profile.create({
    data: { userId: user.id },
  });

  // Fire Telegram notification (non-blocking)
  notifyNewUser({ name: user.name, email: user.email, authProvider: 'GOOGLE' }).catch(() => {});

  return { user: sanitizeUser(user), token: generateToken(user), isNew: true };
}

export async function findOrCreateLightningUser(pubkey: string) {
  // Check if user exists by Lightning pubkey
  let user = await prisma.user.findUnique({
    where: { lightningPubkey: pubkey },
    include: { profile: true },
  });

  if (user) {
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }
    return { user: sanitizeUser(user), token: generateToken(user), isNew: false, lightningBonusAwarded: false };
  }

  // Create new user with Lightning
  const newUser = await prisma.user.create({
    data: {
      lightningPubkey: pubkey,
      name: `Lightning_${pubkey.slice(0, 8)}`, // Default name from pubkey
      authProvider: AuthProvider.LIGHTNING,
    },
  });

  // Create profile
  await prisma.profile.create({
    data: { userId: newUser.id },
  });

  // Award 1 bonus point for signing up with Lightning
  const bonusAwarded = await awardLightningBonusPoint(newUser.id);

  // Fire Telegram notification (non-blocking)
  notifyNewUser({ name: newUser.name, email: null, authProvider: 'LIGHTNING' }).catch(() => {});

  return { user: sanitizeUser(newUser), token: generateToken(newUser), isNew: true, lightningBonusAwarded: bonusAwarded };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) return null;

  return sanitizeUser(user);
}

// ============================================
// HELPERS
// ============================================

function sanitizeUser(user: User & { profile?: any }) {
  const { password, ...sanitized } = user;
  return sanitized;
}

// ============================================
// PROFILE UPDATE
// ============================================

export interface UpdateProfileInput {
  name?: string;
  email?: string;
}

/**
 * Link Lightning wallet to existing account
 */
export async function linkLightningToAccount(userId: string, pubkey: string) {
  // Check if pubkey is already linked to another account
  const existingUser = await prisma.user.findUnique({
    where: { lightningPubkey: pubkey },
  });

  if (existingUser) {
    if (existingUser.id === userId) {
      throw new Error('This Lightning wallet is already linked to your account');
    }
    throw new Error('This Lightning wallet is already linked to another account');
  }

  // Link the pubkey to the current user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { lightningPubkey: pubkey },
    include: { profile: true },
  });

  // Award 1 bonus point for linking Lightning wallet
  const bonusAwarded = await awardLightningBonusPoint(userId);

  // Generate new token with updated info
  const token = generateToken(updatedUser);

  return {
    user: sanitizeUser(updatedUser),
    token,
    lightningBonusAwarded: bonusAwarded,
  };
}

/**
 * Add email and password to existing account (for Lightning users)
 */
export async function addEmailToAccount(userId: string, email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if user already has email/password
  if (user.email && user.password) {
    throw new Error('This account already has email login configured');
  }

  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error('This email is already in use by another account');
  }

  // Hash password and update user
  const hashedPassword = await hashPassword(password);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { 
      email,
      password: hashedPassword,
    },
    include: { profile: true },
  });

  // Generate new token with updated info
  const token = generateToken(updatedUser);

  return {
    user: sanitizeUser(updatedUser),
    token,
  };
}

/**
 * Get profile details (bio, profileImage) for a user
 */
export async function getProfileDetails(userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
  });

  return {
    bio: profile?.bio || '',
    profileImage: profile?.profileImage || null,
    telegramUsername: profile?.telegramUsername || null,
    telegramVerified: profile?.telegramVerified ?? false,
    telegramVisibility: (profile?.telegramVisibility as 'PUBLIC' | 'ADMIN_ONLY') || 'ADMIN_ONLY',
    nostrPubkey: (profile as any)?.nostrPubkey || null,
    nostrVisibility: ((profile as any)?.nostrVisibility as 'PUBLIC' | 'ADMIN_ONLY') || 'ADMIN_ONLY',
    socialLinks: profile?.socialLinks || null,
    socialLinksVisibility: (profile?.socialLinksVisibility as 'PUBLIC' | 'ADMIN_ONLY') || 'ADMIN_ONLY',
  };
}

/**
 * Update profile details (bio, profileImage, telegramUsername, socialLinks, visibility) for a user
 */
export async function updateProfileDetails(userId: string, input: {
  bio?: string;
  profileImage?: string | null;
  telegramUsername?: string | null;
  telegramVisibility?: 'PUBLIC' | 'ADMIN_ONLY';
  nostrPubkey?: string | null;
  nostrVisibility?: 'PUBLIC' | 'ADMIN_ONLY';
  socialLinks?: Record<string, string> | null;
  socialLinksVisibility?: 'PUBLIC' | 'ADMIN_ONLY';
}) {
  const socialLinksValue = input.socialLinks === null ? Prisma.JsonNull : input.socialLinks;

  // Strip leading @ from telegram username if present
  const telegramUsername = input.telegramUsername
    ? input.telegramUsername.replace(/^@/, '').trim() || null
    : input.telegramUsername;

  // If telegram username is changing, reset verification status
  let clearVerified = false;
  if (input.telegramUsername !== undefined) {
    const existing = await prisma.profile.findUnique({
      where: { userId },
      select: { telegramUsername: true },
    });
    if (existing?.telegramUsername !== telegramUsername) {
      clearVerified = true;
    }
  }
  
  const profile = await (prisma.profile.upsert as any)({
    where: { userId },
    update: {
      ...(input.bio !== undefined && { bio: input.bio }),
      ...(input.profileImage !== undefined && { profileImage: input.profileImage }),
      ...(input.telegramUsername !== undefined && { telegramUsername }),
      ...(clearVerified && { telegramVerified: false }),
      ...(input.telegramVisibility !== undefined && { telegramVisibility: input.telegramVisibility }),
      ...(input.nostrPubkey !== undefined && { nostrPubkey: input.nostrPubkey }),
      ...(input.nostrVisibility !== undefined && { nostrVisibility: input.nostrVisibility }),
      ...(input.socialLinks !== undefined && { socialLinks: socialLinksValue }),
      ...(input.socialLinksVisibility !== undefined && { socialLinksVisibility: input.socialLinksVisibility }),
    },
    create: {
      userId,
      bio: input.bio || '',
      profileImage: input.profileImage || null,
      telegramUsername: telegramUsername || null,
      nostrPubkey: input.nostrPubkey || null,
      socialLinks: input.socialLinks ? input.socialLinks : Prisma.JsonNull,
    },
  });

  return {
    bio: profile.bio,
    profileImage: profile.profileImage,
    telegramUsername: profile.telegramUsername,
    telegramVerified: profile.telegramVerified,
    telegramVisibility: (profile.telegramVisibility || 'ADMIN_ONLY') as 'PUBLIC' | 'ADMIN_ONLY',
    nostrPubkey: profile.nostrPubkey || null,
    nostrVisibility: (profile.nostrVisibility || 'ADMIN_ONLY') as 'PUBLIC' | 'ADMIN_ONLY',
    socialLinks: profile.socialLinks,
    socialLinksVisibility: (profile.socialLinksVisibility || 'ADMIN_ONLY') as 'PUBLIC' | 'ADMIN_ONLY',
  };
}

/**
 * Get a public player profile by user ID (for public profile pages)
 * @param isAdmin - if true, visibility restrictions are bypassed
 */
export async function getPublicPlayerProfile(userId: string, isAdmin = false) {
  const user = await (prisma.user.findUnique as any)({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      avatar: true,
      isGuest: true,
      createdAt: true,
      profile: {
        select: {
          bio: true,
          profileImage: true,
          telegramUsername: true,
          telegramVerified: true,
          telegramVisibility: true,
          nostrPubkey: true,
          nostrVisibility: true,
          socialLinks: true,
          socialLinksVisibility: true,
        },
      },
    },
  });

  if (!user) return null;

  const profile = user.profile as any;

  // Respect visibility settings (admin bypasses them)
  const telegramPublic = isAdmin || (profile?.telegramVisibility ?? 'ADMIN_ONLY') === 'PUBLIC';
  const nostrPublic = isAdmin || (profile?.nostrVisibility ?? 'ADMIN_ONLY') === 'PUBLIC';
  const socialLinksPublic = isAdmin || (profile?.socialLinksVisibility ?? 'ADMIN_ONLY') === 'PUBLIC';

  // Get current season standing
  const activeSeason = await prisma.season.findFirst({
    where: { isActive: true },
  });

  let currentSeasonStanding = null;
  if (activeSeason) {
    const standing = await prisma.standing.findUnique({
      where: {
        seasonId_userId: {
          seasonId: activeSeason.id,
          userId,
        },
      },
    });
    if (standing) {
      currentSeasonStanding = {
        seasonName: activeSeason.name,
        totalPoints: standing.totalPoints,
        eventsPlayed: standing.eventsPlayed,
        wins: standing.wins,
        topThrees: standing.topThrees,
        knockouts: standing.knockouts,
        rank: standing.rank,
      };
    }
  }

  // Get upcoming registered events
  const upcomingSignups = await prisma.eventSignup.findMany({
    where: {
      userId,
      event: {
        dateTime: { gte: new Date() },
        status: { not: 'CANCELLED' },
      },
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          dateTime: true,
          venue: { select: { name: true } },
        },
      },
    },
    orderBy: { event: { dateTime: 'asc' } },
    take: 5,
  });

  // Get recent results
  const recentResults = await prisma.result.findMany({
    where: { userId },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          dateTime: true,
          venue: { select: { name: true } },
        },
      },
    },
    orderBy: { event: { dateTime: 'desc' } },
    take: 10,
  });

  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar,
    isGuest: user.isGuest,
    memberSince: user.createdAt.toISOString(),
    bio: profile?.bio || '',
    profileImage: profile?.profileImage || null,
    // Telegram: only include if PUBLIC (or admin)
    telegramUsername: telegramPublic ? (profile?.telegramUsername || null) : null,
    telegramVerified: telegramPublic ? (profile?.telegramVerified ?? false) : false,
    telegramVisibility: (profile?.telegramVisibility || 'ADMIN_ONLY') as 'PUBLIC' | 'ADMIN_ONLY',
    // Nostr: only include if PUBLIC (or admin)
    nostrPubkey: nostrPublic ? (profile?.nostrPubkey || null) : null,
    nostrVisibility: (profile?.nostrVisibility || 'ADMIN_ONLY') as 'PUBLIC' | 'ADMIN_ONLY',
    // Social links: only include if PUBLIC (or admin)
    socialLinks: socialLinksPublic ? (profile?.socialLinks || null) : null,
    socialLinksVisibility: (profile?.socialLinksVisibility || 'ADMIN_ONLY') as 'PUBLIC' | 'ADMIN_ONLY',
    currentSeasonStanding,
    upcomingEvents: upcomingSignups.map(s => ({
      id: s.event.id,
      name: s.event.name,
      dateTime: s.event.dateTime,
      venue: s.event.venue.name,
    })),
    recentResults: recentResults.map(r => ({
      eventId: r.event.id,
      eventName: r.event.name,
      eventDate: r.event.dateTime,
      venue: r.event.venue.name,
      position: r.position,
      pointsEarned: r.pointsEarned,
      knockouts: r.knockouts,
    })),
  };
}

// ============================================
// GUEST CLAIM TOKEN
// ============================================

/**
 * Generate a claim token for a guest user (admin action)
 * Token expires in 7 days
 */
export async function generateClaimToken(guestUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: guestUserId } });
  
  if (!user) throw new Error('User not found');
  if (!user.isGuest) throw new Error('User is not a guest account');
  
  // Generate a secure random token
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  await prisma.user.update({
    where: { id: guestUserId },
    data: {
      claimToken: token,
      claimTokenExpiry: expiry,
    },
  });
  
  return { token, expiresAt: expiry, guestName: user.name };
}

/**
 * Validate a claim token and return guest info
 */
export async function validateClaimToken(token: string) {
  const user = await prisma.user.findUnique({
    where: { claimToken: token },
  });
  
  if (!user) throw new Error('Invalid or expired claim link');
  if (!user.isGuest) throw new Error('This account has already been claimed');
  if (user.claimTokenExpiry && user.claimTokenExpiry < new Date()) {
    throw new Error('This claim link has expired. Ask the admin for a new one.');
  }
  
  return {
    guestName: user.name,
    guestId: user.id,
  };
}

/**
 * Claim a guest account: set email/password, convert from guest to real user
 */
export async function claimGuestAccount(token: string, email: string, password: string, name?: string) {
  const user = await prisma.user.findUnique({
    where: { claimToken: token },
  });
  
  if (!user) throw new Error('Invalid or expired claim link');
  if (!user.isGuest) throw new Error('This account has already been claimed');
  if (user.claimTokenExpiry && user.claimTokenExpiry < new Date()) {
    throw new Error('This claim link has expired. Ask the admin for a new one.');
  }
  
  // Check if email is already taken
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) throw new Error('This email is already in use');
  
  const hashedPassword = await hashPassword(password);
  
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      email,
      password: hashedPassword,
      name: name || user.name,
      nameSetAt: name ? new Date() : user.nameSetAt,
      isGuest: false,
      authProvider: AuthProvider.EMAIL,
      claimToken: null,
      claimTokenExpiry: null,
    },
    include: { profile: true },
  });
  
  // Create profile if it doesn't exist
  if (!updatedUser.profile) {
    await prisma.profile.create({ data: { userId: updatedUser.id } });
  }
  
  const jwtToken = generateToken(updatedUser);
  
  return {
    user: sanitizeUser(updatedUser),
    token: jwtToken,
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if name change is allowed (only once)
  if (input.name && input.name !== user.name && user.nameSetAt) {
    throw new Error('Name can only be set once. Please contact support if you need to change it.');
  }

  // If email is being set, check it's not already taken
  if (input.email && input.email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });
    if (existingUser) {
      throw new Error('Email is already in use');
    }
  }

  // Prepare update data
  const updateData: any = {};
  
  // Only update name if it's changing and allowed
  if (input.name && input.name !== user.name) {
    updateData.name = input.name;
    updateData.nameSetAt = new Date(); // Lock the name
  }
  
  // Email can always be updated
  if (input.email) {
    updateData.email = input.email;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    include: { profile: true },
  });

  // Generate new token with updated info
  const token = generateToken(updatedUser);

  return {
    user: sanitizeUser(updatedUser),
    token,
  };
}
