/**
 * Withdrawal Service
 * 
 * Handles LNURL-withdraw flow for paying out sats to users.
 * 
 * Flow:
 * 1. Admin creates withdrawal for user (generates k1, stores in DB)
 * 2. User scans QR / clicks link
 * 3. User's wallet calls our LNURL endpoint to get withdrawal details
 * 4. User's wallet generates invoice and submits to callback
 * 5. We pay the invoice via Voltage node
 * 6. Mark withdrawal as paid
 */

import crypto from 'crypto';
import { bech32 } from 'bech32';
import prisma from '../lib/prisma';
import { payInvoice, decodeInvoice, isVoltageConfigured, getChannelBalance } from './voltage.service';
import { notifyWithdrawalProcessed } from './telegram.service';
import { WithdrawalStatus } from '@prisma/client';

const LNURL_BASE_URL = process.env.LNURL_BASE_URL || process.env.LIGHTNING_AUTH_URL?.replace('/auth/lightning', '') || 'http://localhost:3001/api';

// ============================================
// WITHDRAWAL CREATION (Admin)
// ============================================

/**
 * Generate a random k1 secret for LNURL-withdraw
 */
function generateK1(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Encode URL to LNURL (bech32)
 */
function encodeLnurl(url: string): string {
  const words = bech32.toWords(Buffer.from(url, 'utf8'));
  return bech32.encode('lnurl', words, 1023);
}

/**
 * Create a new withdrawal for a user
 * 
 * @param userId - The user who will receive the sats
 * @param amountSats - Amount in satoshis
 * @param description - Optional description (e.g., "1st Place - Tuesday Poker")
 * @param expiresInHours - How long until the withdrawal expires (default 24 hours)
 */
export async function createWithdrawal(
  userId: string,
  amountSats: number,
  description?: string,
  expiresInHours: number = 24
): Promise<{
  withdrawal: {
    id: string;
    k1: string;
    amountSats: number;
    status: WithdrawalStatus;
    expiresAt: Date;
  };
  lnurl: string;
  qrData: string;
  lightningUri: string;
}> {
  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('User not found');
  }

  // Check Voltage is configured
  if (!isVoltageConfigured()) {
    throw new Error('Lightning payments not configured. Set VOLTAGE_REST_HOST and VOLTAGE_MACAROON.');
  }

  // Check we have enough balance
  const { balanceSats } = await getChannelBalance();
  if (balanceSats < amountSats) {
    throw new Error(`Insufficient node balance. Have ${balanceSats} sats, need ${amountSats} sats.`);
  }

  const k1 = generateK1();
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  // Create withdrawal record
  const withdrawal = await prisma.withdrawal.create({
    data: {
      k1,
      userId,
      amountSats,
      description,
      expiresAt,
      status: 'PENDING',
    },
  });

  // Build LNURL
  const callbackUrl = `${LNURL_BASE_URL}/lnurl/withdraw?k1=${k1}`;
  const lnurl = encodeLnurl(callbackUrl);
  const lightningUri = `lightning:${lnurl}`;

  return {
    withdrawal: {
      id: withdrawal.id,
      k1: withdrawal.k1,
      amountSats: withdrawal.amountSats,
      status: withdrawal.status,
      expiresAt: withdrawal.expiresAt,
    },
    lnurl,
    qrData: lnurl.toUpperCase(), // QR codes work better with uppercase
    lightningUri,
  };
}

// ============================================
// LNURL-WITHDRAW PROTOCOL HANDLERS
// ============================================

/**
 * Handle initial LNURL-withdraw request from wallet
 * Wallet calls: GET /api/lnurl/withdraw?k1=xxx
 * 
 * Returns withdrawal details per LUD-03 spec
 */
export async function handleWithdrawRequest(k1: string): Promise<{
  tag: string;
  callback: string;
  k1: string;
  minWithdrawable: number;
  maxWithdrawable: number;
  defaultDescription: string;
} | { status: string; reason: string }> {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { k1 },
    include: { user: { select: { name: true } } },
  });

  if (!withdrawal) {
    return { status: 'ERROR', reason: 'Withdrawal not found' };
  }

  if (withdrawal.status !== 'PENDING') {
    return { status: 'ERROR', reason: `Withdrawal already ${withdrawal.status.toLowerCase()}` };
  }

  if (withdrawal.expiresAt < new Date()) {
    // Mark as expired
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: 'EXPIRED' },
    });
    return { status: 'ERROR', reason: 'Withdrawal expired' };
  }

  // Return LNURL-withdraw response per spec
  const callbackUrl = `${LNURL_BASE_URL}/lnurl/withdraw/callback`;
  const amountMillisats = withdrawal.amountSats * 1000;

  return {
    tag: 'withdrawRequest',
    callback: callbackUrl,
    k1: withdrawal.k1,
    minWithdrawable: amountMillisats,
    maxWithdrawable: amountMillisats,
    defaultDescription: withdrawal.description || `Roatan Poker Payout - ${withdrawal.user.name}`,
  };
}

/**
 * Handle withdrawal callback from wallet
 * Wallet calls: GET /api/lnurl/withdraw/callback?k1=xxx&pr=lnbc...
 * 
 * We pay the invoice and mark withdrawal as complete
 */
export async function handleWithdrawCallback(
  k1: string,
  paymentRequest: string
): Promise<{ status: string; reason?: string }> {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { k1 },
  });

  if (!withdrawal) {
    return { status: 'ERROR', reason: 'Withdrawal not found' };
  }

  if (withdrawal.status !== 'PENDING') {
    return { status: 'ERROR', reason: `Withdrawal already ${withdrawal.status.toLowerCase()}` };
  }

  if (withdrawal.expiresAt < new Date()) {
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: 'EXPIRED' },
    });
    return { status: 'ERROR', reason: 'Withdrawal expired' };
  }

  // Decode invoice to verify amount
  try {
    const decoded = await decodeInvoice(paymentRequest);
    const invoiceAmountSats = parseInt(decoded.num_satoshis, 10);

    // For LNURL-withdraw, invoice should match our amount exactly
    // (or be zero-amount, which we'll fill in)
    if (invoiceAmountSats > 0 && invoiceAmountSats !== withdrawal.amountSats) {
      return { 
        status: 'ERROR', 
        reason: `Invoice amount (${invoiceAmountSats}) doesn't match withdrawal (${withdrawal.amountSats})` 
      };
    }

    // Mark as claimed (payment in progress)
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { 
        status: 'CLAIMED',
        invoice: paymentRequest,
      },
    });

    // Pay the invoice
    const paymentResult = await payInvoice(paymentRequest, withdrawal.amountSats);

    if (paymentResult.success) {
      // Mark as paid
      const paidWithdrawal = await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'PAID',
          paymentHash: paymentResult.paymentHash,
          paidAt: new Date(),
        },
        include: { user: { select: { name: true, email: true } } },
      });

      console.log(`[Withdrawal] Successfully paid ${withdrawal.amountSats} sats to user ${withdrawal.userId}`);

      // Notify admins (non-blocking)
      notifyWithdrawalProcessed({
        userName: paidWithdrawal.user.name,
        userEmail: paidWithdrawal.user.email,
        amountSats: withdrawal.amountSats,
        description: withdrawal.description,
      }).catch(() => {});

      return { status: 'OK' };
    } else {
      // Payment failed
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'FAILED',
        },
      });

      console.error(`[Withdrawal] Payment failed: ${paymentResult.error}`);
      return { status: 'ERROR', reason: paymentResult.error || 'Payment failed' };
    }
  } catch (error) {
    console.error('[Withdrawal] Error processing callback:', error);
    
    // Reset to pending so user can try again
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: 'PENDING', invoice: null },
    });

    return { 
      status: 'ERROR', 
      reason: error instanceof Error ? error.message : 'Failed to process withdrawal' 
    };
  }
}

// ============================================
// WITHDRAWAL MANAGEMENT
// ============================================

/**
 * Get all withdrawals (admin)
 */
export async function getAllWithdrawals(options?: {
  status?: WithdrawalStatus;
  userId?: string;
  limit?: number;
}) {
  return prisma.withdrawal.findMany({
    where: {
      ...(options?.status && { status: options.status }),
      ...(options?.userId && { userId: options.userId }),
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 50,
  });
}

/**
 * Get withdrawals for a specific user
 */
export async function getUserWithdrawals(userId: string) {
  return prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get a single withdrawal with LNURL data
 */
export async function getWithdrawalWithLnurl(withdrawalId: string) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!withdrawal) {
    return null;
  }

  // Generate LNURL data if still pending
  if (withdrawal.status === 'PENDING') {
    const callbackUrl = `${LNURL_BASE_URL}/lnurl/withdraw?k1=${withdrawal.k1}`;
    const lnurl = encodeLnurl(callbackUrl);

    return {
      ...withdrawal,
      lnurl,
      qrData: lnurl.toUpperCase(),
      lightningUri: `lightning:${lnurl}`,
    };
  }

  return withdrawal;
}

/**
 * Cancel a pending withdrawal
 */
export async function cancelWithdrawal(withdrawalId: string): Promise<boolean> {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });

  if (!withdrawal || withdrawal.status !== 'PENDING') {
    return false;
  }

  await prisma.withdrawal.update({
    where: { id: withdrawalId },
    data: { status: 'EXPIRED' },
  });

  return true;
}

/**
 * Clean up expired withdrawals
 */
export async function cleanupExpiredWithdrawals(): Promise<number> {
  const result = await prisma.withdrawal.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });

  return result.count;
}

/**
 * Get withdrawal statistics
 */
export async function getWithdrawalStats() {
  const [pending, paid, failed, totalPaid] = await Promise.all([
    prisma.withdrawal.count({ where: { status: 'PENDING' } }),
    prisma.withdrawal.count({ where: { status: 'PAID' } }),
    prisma.withdrawal.count({ where: { status: 'FAILED' } }),
    prisma.withdrawal.aggregate({
      where: { status: 'PAID' },
      _sum: { amountSats: true },
    }),
  ]);

  return {
    pending,
    paid,
    failed,
    totalPaidSats: totalPaid._sum.amountSats || 0,
  };
}
