/**
 * Referral Service
 * 
 * Manages the referral system: code generation, reward processing, and stats.
 * Reward: 10,000 sats credited to the referrer when the referred user gets
 * checked in at their first event.
 * 
 * NOTE: Uses `as any` casts on Prisma calls because the new referral columns
 * (referralCode, referredById, referralRewardPaid) aren't in the generated
 * client until `prisma generate` runs after the migration is applied on deploy.
 * These casts can be removed once the Prisma client is regenerated.
 */

import crypto from 'crypto';
import prisma from '../lib/prisma';
import { creditBalance } from './balance.service';

let REFERRAL_REWARD_SATS = parseInt(process.env.REFERRAL_REWARD_SATS || '10000', 10);

export function getReferralRewardAmount(): number {
  return REFERRAL_REWARD_SATS;
}

export function setReferralRewardAmount(sats: number): void {
  REFERRAL_REWARD_SATS = sats;
}

// Helper: typed prisma.user with `as any` to bypass generated client lag
const userModel = prisma.user as any;

// ============================================
// REFERRAL CODE MANAGEMENT
// ============================================

function generateReferralCode(): string {
  return crypto.randomBytes(4).toString('hex');
}

export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const user = await userModel.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });

  if (!user) throw new Error('User not found');
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      const updated = await userModel.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch (err: any) {
      if (err.code === 'P2002') continue;
      throw err;
    }
  }

  throw new Error('Failed to generate unique referral code');
}

export async function findReferrerByCode(referralCode: string): Promise<{ id: string; name: string } | null> {
  const user = await userModel.findUnique({
    where: { referralCode },
    select: { id: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) return null;
  return { id: user.id, name: user.name };
}

export async function linkReferral(newUserId: string, referrerUserId: string): Promise<void> {
  if (newUserId === referrerUserId) return;

  await userModel.update({
    where: { id: newUserId },
    data: { referredById: referrerUserId },
  });
}

// ============================================
// REWARD PROCESSING
// ============================================

export async function processReferralReward(checkedInUserId: string): Promise<{
  rewarded: boolean;
  referrerId?: string;
  referrerName?: string;
  amountSats?: number;
}> {
  const user = await userModel.findUnique({
    where: { id: checkedInUserId },
    select: { referredById: true, referralRewardPaid: true },
  });

  if (!user?.referredById || user.referralRewardPaid) {
    return { rewarded: false };
  }

  const referrer = await userModel.findUnique({
    where: { id: user.referredById },
    select: { id: true, name: true, isActive: true },
  });

  if (!referrer || !referrer.isActive) {
    return { rewarded: false };
  }

  // Mark as paid FIRST (prevent double-pay in race conditions)
  await userModel.update({
    where: { id: checkedInUserId },
    data: { referralRewardPaid: true },
  });

  await creditBalance(
    referrer.id,
    REFERRAL_REWARD_SATS,
    `Referral reward — referred user checked in at event`
  );

  console.log(`[Referral] Paid ${REFERRAL_REWARD_SATS} sats to ${referrer.name} (${referrer.id}) for referring user ${checkedInUserId}`);

  return {
    rewarded: true,
    referrerId: referrer.id,
    referrerName: referrer.name,
    amountSats: REFERRAL_REWARD_SATS,
  };
}

// ============================================
// STATS & QUERIES
// ============================================

export async function getReferralStats(userId: string): Promise<{
  referralCode: string;
  totalReferred: number;
  totalCheckedIn: number;
  totalSatsEarned: number;
  referrals: {
    id: string;
    name: string;
    createdAt: string;
    checkedIn: boolean;
    rewardPaid: boolean;
  }[];
}> {
  const referralCode = await getOrCreateReferralCode(userId);

  const referrals = await userModel.findMany({
    where: { referredById: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      referralRewardPaid: true,
      eventSignups: {
        where: { status: 'CHECKED_IN' },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const totalCheckedIn = referrals.filter((r: any) => r.eventSignups.length > 0).length;
  const totalRewardsPaid = referrals.filter((r: any) => r.referralRewardPaid).length;

  return {
    referralCode,
    totalReferred: referrals.length,
    totalCheckedIn,
    totalSatsEarned: totalRewardsPaid * REFERRAL_REWARD_SATS,
    referrals: referrals.map((r: any) => ({
      id: r.id,
      name: r.name,
      createdAt: r.createdAt.toISOString(),
      checkedIn: r.eventSignups.length > 0,
      rewardPaid: r.referralRewardPaid,
    })),
  };
}

export async function validateReferralCode(code: string): Promise<{ valid: boolean; referrerName?: string }> {
  const referrer = await findReferrerByCode(code);
  if (!referrer) return { valid: false };
  return { valid: true, referrerName: referrer.name };
}

// ============================================
// ADMIN OVERVIEW
// ============================================

export async function getAdminReferralOverview(): Promise<{
  rewardSats: number;
  totalReferrals: number;
  totalPending: number;
  totalCheckedIn: number;
  totalSatsPaid: number;
  referrers: {
    id: string;
    name: string;
    referralCode: string | null;
    referralCount: number;
    checkedInCount: number;
    satsPaid: number;
    referrals: {
      id: string;
      name: string;
      createdAt: string;
      checkedIn: boolean;
      rewardPaid: boolean;
    }[];
  }[];
}> {
  // Get all users who were referred (have referredById set)
  const referredUsers = await userModel.findMany({
    where: { referredById: { not: null } },
    select: {
      id: true,
      name: true,
      createdAt: true,
      referredById: true,
      referralRewardPaid: true,
      eventSignups: {
        where: { status: 'CHECKED_IN' },
        take: 1,
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Get all referrers (users who have referred at least one person)
  const referrerIds = [...new Set(referredUsers.map((u: any) => u.referredById))];
  const referrerUsers = await userModel.findMany({
    where: { id: { in: referrerIds } },
    select: { id: true, name: true, referralCode: true },
  });

  const referrerMap = new Map<string, any>(referrerUsers.map((u: any) => [u.id, u]));

  // Group referrals by referrer
  const referrerGroups = new Map<string, any[]>();
  for (const referred of referredUsers) {
    const referrerId = referred.referredById;
    if (!referrerGroups.has(referrerId)) {
      referrerGroups.set(referrerId, []);
    }
    referrerGroups.get(referrerId)!.push(referred);
  }

  let totalPending = 0;
  let totalCheckedIn = 0;
  let totalSatsPaid = 0;

  const referrers = Array.from(referrerGroups.entries()).map(([referrerId, referrals]) => {
    const referrer = referrerMap.get(referrerId);
    const checkedInCount = referrals.filter((r: any) => r.eventSignups.length > 0).length;
    const paidCount = referrals.filter((r: any) => r.referralRewardPaid).length;
    const pendingCount = referrals.length - checkedInCount;
    const satsPaid = paidCount * REFERRAL_REWARD_SATS;

    totalPending += pendingCount;
    totalCheckedIn += checkedInCount;
    totalSatsPaid += satsPaid;

    return {
      id: referrerId,
      name: referrer?.name || 'Unknown',
      referralCode: referrer?.referralCode || null,
      referralCount: referrals.length,
      checkedInCount,
      satsPaid,
      referrals: referrals.map((r: any) => ({
        id: r.id,
        name: r.name,
        createdAt: r.createdAt.toISOString(),
        checkedIn: r.eventSignups.length > 0,
        rewardPaid: r.referralRewardPaid,
      })),
    };
  });

  // Sort referrers by referral count (most referrals first)
  referrers.sort((a, b) => b.referralCount - a.referralCount);

  return {
    rewardSats: REFERRAL_REWARD_SATS,
    totalReferrals: referredUsers.length,
    totalPending,
    totalCheckedIn,
    totalSatsPaid,
    referrers,
  };
}
