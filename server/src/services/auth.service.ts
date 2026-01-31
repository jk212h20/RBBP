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
