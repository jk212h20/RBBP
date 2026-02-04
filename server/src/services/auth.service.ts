import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, AuthProvider } from '@prisma/client';
import prisma from '../lib/prisma';

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
  const { email, password, name } = input;

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

  // Create profile
  await prisma.profile.create({
    data: { userId: user.id },
  });

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

  return { user: sanitizeUser(user), token: generateToken(user), isNew: true };
}

export async function findOrCreateLightningUser(pubkey: string) {
  // Check if user exists by Lightning pubkey
  let user = await prisma.user.findUnique({
    where: { lightningPubkey: pubkey },
  });

  if (user) {
    return { user: sanitizeUser(user), token: generateToken(user), isNew: false };
  }

  // Create new user with Lightning
  user = await prisma.user.create({
    data: {
      lightningPubkey: pubkey,
      name: `Lightning_${pubkey.slice(0, 8)}`, // Default name from pubkey
      authProvider: AuthProvider.LIGHTNING,
    },
  });

  // Create profile
  await prisma.profile.create({
    data: { userId: user.id },
  });

  return { user: sanitizeUser(user), token: generateToken(user), isNew: true };
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

  // Generate new token with updated info
  const token = generateToken(updatedUser);

  return {
    user: sanitizeUser(updatedUser),
    token,
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
