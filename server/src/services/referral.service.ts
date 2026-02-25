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

const REFERRAL_REWARD_SATS = 10_000;

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
