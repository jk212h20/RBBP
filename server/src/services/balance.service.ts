/**
 * Balance Service
 * 
 * Manages user Lightning balances - credit, debit, and withdrawal operations.
 */

import prisma from '../lib/prisma';
import { createWithdrawal } from './withdrawal.service';

// ============================================
// BALANCE QUERIES
// ============================================

/**
 * Get a user's current Lightning balance
 */
export async function getUserBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lightningBalanceSats: true },
  });
  
  return user?.lightningBalanceSats || 0;
}

/**
 * Get all users with their balances (admin)
 */
export async function getAllUsersWithBalances() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      lightningBalanceSats: true,
      role: true,
    },
    orderBy: { lightningBalanceSats: 'desc' },
  });
}

/**
 * Get users with non-zero balances (admin)
 */
export async function getUsersWithBalances() {
  return prisma.user.findMany({
    where: { 
      isActive: true,
      lightningBalanceSats: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      email: true,
      lightningBalanceSats: true,
    },
    orderBy: { lightningBalanceSats: 'desc' },
  });
}

// ============================================
// BALANCE MODIFICATIONS
// ============================================

/**
 * Credit sats to a user's balance (admin operation)
 * 
 * @param userId - User to credit
 * @param amountSats - Amount to add
 * @param reason - Optional reason for the credit
 * @returns Updated balance
 */
export async function creditBalance(
  userId: string,
  amountSats: number,
  reason?: string
): Promise<{ userId: string; newBalance: number; credited: number }> {
  if (amountSats <= 0) {
    throw new Error('Amount must be positive');
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  // Credit the balance
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      lightningBalanceSats: { increment: amountSats },
    },
    select: { id: true, name: true, lightningBalanceSats: true },
  });

  console.log(`[Balance] Credited ${amountSats} sats to ${user.name} (${userId}). Reason: ${reason || 'N/A'}. New balance: ${updated.lightningBalanceSats}`);

  return {
    userId: updated.id,
    newBalance: updated.lightningBalanceSats,
    credited: amountSats,
  };
}

/**
 * Debit sats from a user's balance (internal operation)
 * 
 * @param userId - User to debit
 * @param amountSats - Amount to subtract
 * @returns Updated balance
 */
export async function debitBalance(
  userId: string,
  amountSats: number
): Promise<{ userId: string; newBalance: number; debited: number }> {
  if (amountSats <= 0) {
    throw new Error('Amount must be positive');
  }

  // Get current balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lightningBalanceSats: true, name: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.lightningBalanceSats < amountSats) {
    throw new Error(`Insufficient balance. Have ${user.lightningBalanceSats} sats, need ${amountSats} sats.`);
  }

  // Debit the balance
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      lightningBalanceSats: { decrement: amountSats },
    },
    select: { id: true, lightningBalanceSats: true },
  });

  console.log(`[Balance] Debited ${amountSats} sats from ${user.name} (${userId}). New balance: ${updated.lightningBalanceSats}`);

  return {
    userId: updated.id,
    newBalance: updated.lightningBalanceSats,
    debited: amountSats,
  };
}

/**
 * Set a user's balance to a specific amount (admin operation)
 */
export async function setBalance(
  userId: string,
  amountSats: number
): Promise<{ userId: string; newBalance: number }> {
  if (amountSats < 0) {
    throw new Error('Balance cannot be negative');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { lightningBalanceSats: amountSats },
    select: { id: true, lightningBalanceSats: true },
  });

  return {
    userId: updated.id,
    newBalance: updated.lightningBalanceSats,
  };
}

// ============================================
// WITHDRAWAL FROM BALANCE
// ============================================

/**
 * Initiate a withdrawal from user's balance
 * Creates an LNURL-withdraw that the user can claim
 * 
 * @param userId - User requesting withdrawal
 * @param amountSats - Amount to withdraw (optional, defaults to full balance)
 * @returns Withdrawal details with LNURL
 */
export async function initiateWithdrawal(
  userId: string,
  amountSats?: number
): Promise<{
  withdrawal: {
    id: string;
    k1: string;
    amountSats: number;
    status: string;
    expiresAt: Date;
  };
  lnurl: string;
  qrData: string;
  lightningUri: string;
}> {
  // Get user's balance
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lightningBalanceSats: true, name: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const withdrawAmount = amountSats || user.lightningBalanceSats;

  if (withdrawAmount <= 0) {
    throw new Error('No balance to withdraw');
  }

  if (withdrawAmount > user.lightningBalanceSats) {
    throw new Error(`Insufficient balance. Have ${user.lightningBalanceSats} sats, requested ${withdrawAmount} sats.`);
  }

  // Minimum withdrawal amount
  const MIN_WITHDRAWAL = 100; // 100 sats minimum
  if (withdrawAmount < MIN_WITHDRAWAL) {
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAWAL} sats`);
  }

  // Debit the balance first (optimistic - we'll refund if withdrawal fails)
  await debitBalance(userId, withdrawAmount);

  try {
    // Create the withdrawal
    const result = await createWithdrawal(
      userId,
      withdrawAmount,
      `Balance withdrawal - ${user.name}`,
      24 // 24 hour expiry
    );

    console.log(`[Balance] Created withdrawal for ${withdrawAmount} sats for user ${userId}`);

    return result;
  } catch (error) {
    // Refund the balance if withdrawal creation fails
    await creditBalance(userId, withdrawAmount, 'Refund - withdrawal creation failed');
    throw error;
  }
}

/**
 * Handle withdrawal completion - called when a withdrawal is paid or expires
 * If expired/failed, refund the balance
 */
export async function handleWithdrawalComplete(
  withdrawalId: string,
  status: 'PAID' | 'EXPIRED' | 'FAILED'
): Promise<void> {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    select: { userId: true, amountSats: true, status: true },
  });

  if (!withdrawal) {
    console.error(`[Balance] Withdrawal ${withdrawalId} not found`);
    return;
  }

  // If withdrawal failed or expired, refund the balance
  if (status === 'EXPIRED' || status === 'FAILED') {
    await creditBalance(
      withdrawal.userId,
      withdrawal.amountSats,
      `Refund - withdrawal ${status.toLowerCase()}`
    );
    console.log(`[Balance] Refunded ${withdrawal.amountSats} sats to user ${withdrawal.userId} (withdrawal ${status})`);
  }
}

// ============================================
// STATISTICS
// ============================================

/**
 * Get total outstanding balance across all users
 */
export async function getTotalOutstandingBalance(): Promise<number> {
  const result = await prisma.user.aggregate({
    _sum: { lightningBalanceSats: true },
  });
  
  return result._sum.lightningBalanceSats || 0;
}

/**
 * Get balance statistics
 */
export async function getBalanceStats(): Promise<{
  totalOutstanding: number;
  usersWithBalance: number;
  averageBalance: number;
  maxBalance: number;
}> {
  const [total, usersWithBalance, maxBalance] = await Promise.all([
    prisma.user.aggregate({
      _sum: { lightningBalanceSats: true },
    }),
    prisma.user.count({
      where: { lightningBalanceSats: { gt: 0 } },
    }),
    prisma.user.aggregate({
      _max: { lightningBalanceSats: true },
    }),
  ]);

  const totalOutstanding = total._sum.lightningBalanceSats || 0;

  return {
    totalOutstanding,
    usersWithBalance,
    averageBalance: usersWithBalance > 0 ? Math.round(totalOutstanding / usersWithBalance) : 0,
    maxBalance: maxBalance._max.lightningBalanceSats || 0,
  };
}
