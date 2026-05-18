/**
 * Lightning Deposit Service
 *
 * Creates BOLT11 invoices for users, watches for settlement, and credits
 * Lightning balances exactly once when LND reports an invoice is paid.
 */

import prisma from '../lib/prisma';
import { createInvoice, lookupInvoice, isVoltageConfigured } from './voltage.service';
import { DepositStatus } from '@prisma/client';

const MIN_DEPOSIT_SATS = parseInt(process.env.MIN_DEPOSIT_SATS || '100', 10);
const MAX_DEPOSIT_SATS = parseInt(process.env.MAX_DEPOSIT_SATS || '250000', 10);
const DEPOSIT_INVOICE_EXPIRY_SECONDS = parseInt(process.env.DEPOSIT_INVOICE_EXPIRY_SECONDS || '600', 10);
const PENDING_SETTLEMENT_BATCH_SIZE = parseInt(process.env.DEPOSIT_SETTLEMENT_BATCH_SIZE || '25', 10);

export interface DepositResponse {
  deposit: {
    id: string;
    amountSats: number;
    status: DepositStatus;
    expiresAt: Date;
    settledAt?: Date | null;
  };
  paymentRequest: string;
  lightningUri: string;
  qrData: string;
}

export interface DepositStatusResponse {
  id: string;
  status: DepositStatus;
  amountSats: number;
  expiresAt: Date;
  settledAt: Date | null;
  balanceSats: number;
}

function validateDepositAmount(amountSats: unknown): number {
  const amount = typeof amountSats === 'number' ? amountSats : parseInt(String(amountSats), 10);

  if (!Number.isInteger(amount)) {
    throw new Error('Deposit amount must be a whole number of sats');
  }

  if (amount < MIN_DEPOSIT_SATS) {
    throw new Error(`Minimum deposit is ${MIN_DEPOSIT_SATS.toLocaleString()} sats`);
  }

  if (amount > MAX_DEPOSIT_SATS) {
    throw new Error(`Maximum deposit is ${MAX_DEPOSIT_SATS.toLocaleString()} sats`);
  }

  return amount;
}

export function getDepositLimits() {
  return {
    minDepositSats: MIN_DEPOSIT_SATS,
    maxDepositSats: MAX_DEPOSIT_SATS,
    invoiceExpirySeconds: DEPOSIT_INVOICE_EXPIRY_SECONDS,
  };
}

/**
 * Create a Lightning invoice for a user to fund their site balance.
 */
export async function createDeposit(userId: string, amountSats: unknown): Promise<DepositResponse> {
  const amount = validateDepositAmount(amountSats);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new Error('User not found');
  }

  if (!isVoltageConfigured()) {
    throw new Error('Lightning deposits are not configured yet. Please try again later.');
  }

  const memo = `Roatan Poker deposit - ${user.name}`;
  const invoice = await createInvoice(amount, memo, DEPOSIT_INVOICE_EXPIRY_SECONDS);
  const expiresAt = new Date(Date.now() + DEPOSIT_INVOICE_EXPIRY_SECONDS * 1000);

  const deposit = await prisma.lightningDeposit.create({
    data: {
      userId,
      amountSats: amount,
      paymentRequest: invoice.paymentRequest,
      paymentHash: invoice.paymentHash,
      memo,
      expiresAt,
      status: 'PENDING',
    },
  });

  console.log(`[Deposit] Created invoice for ${amount} sats for user ${userId}. Deposit ${deposit.id}`);

  return {
    deposit: {
      id: deposit.id,
      amountSats: deposit.amountSats,
      status: deposit.status,
      expiresAt: deposit.expiresAt,
      settledAt: deposit.settledAt,
    },
    paymentRequest: deposit.paymentRequest,
    lightningUri: `lightning:${deposit.paymentRequest}`,
    qrData: deposit.paymentRequest,
  };
}

/**
 * Settle a deposit if LND reports the invoice has been paid.
 * Safe to call repeatedly; already-settled deposits are not credited again.
 */
export async function settleDepositIfPaid(depositId: string): Promise<DepositStatusResponse> {
  const deposit = await prisma.lightningDeposit.findUnique({
    where: { id: depositId },
    select: {
      id: true,
      userId: true,
      amountSats: true,
      paymentHash: true,
      status: true,
      expiresAt: true,
      settledAt: true,
      user: { select: { lightningBalanceSats: true } },
    },
  });

  if (!deposit) {
    throw new Error('Deposit not found');
  }

  if (deposit.status === 'SETTLED') {
    return {
      id: deposit.id,
      status: deposit.status,
      amountSats: deposit.amountSats,
      expiresAt: deposit.expiresAt,
      settledAt: deposit.settledAt,
      balanceSats: deposit.user.lightningBalanceSats,
    };
  }

  if (deposit.status !== 'PENDING') {
    return {
      id: deposit.id,
      status: deposit.status,
      amountSats: deposit.amountSats,
      expiresAt: deposit.expiresAt,
      settledAt: deposit.settledAt,
      balanceSats: deposit.user.lightningBalanceSats,
    };
  }

  let invoiceSettled = false;
  let amountPaidSats = 0;
  let lookupSucceeded = false;

  try {
    const invoice = await lookupInvoice(deposit.paymentHash);
    lookupSucceeded = true;
    invoiceSettled = invoice.settled;
    amountPaidSats = invoice.amountPaidSats;
  } catch (error) {
    // If the invoice lookup has a transient LND/API failure, keep it pending.
    // The cleanup worker can retry later; do not expire without a successful lookup.
    console.error(`[Deposit] Invoice lookup failed for ${deposit.id}:`, error);
  }

  if (invoiceSettled) {
    if (amountPaidSats < deposit.amountSats) {
      console.error(`[Deposit] Paid invoice ${deposit.id} underpaid: expected ${deposit.amountSats}, got ${amountPaidSats}`);
      const failed = await prisma.lightningDeposit.update({
        where: { id: deposit.id },
        data: { status: 'FAILED' },
        select: { id: true, status: true, amountSats: true, expiresAt: true, settledAt: true, user: { select: { lightningBalanceSats: true } } },
      });
      return {
        id: failed.id,
        status: failed.status,
        amountSats: failed.amountSats,
        expiresAt: failed.expiresAt,
        settledAt: failed.settledAt,
        balanceSats: failed.user.lightningBalanceSats,
      };
    }

    const settled = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Atomic claim: only the request that flips PENDING -> SETTLED is allowed to credit.
      const claim = await tx.lightningDeposit.updateMany({
        where: { id: deposit.id, status: 'PENDING' },
        data: { status: 'SETTLED', settledAt: now },
      });

      const current = await tx.lightningDeposit.findUnique({
        where: { id: deposit.id },
        select: { id: true, userId: true, amountSats: true, status: true, expiresAt: true, settledAt: true },
      });

      if (!current) {
        throw new Error('Deposit not found');
      }

      if (claim.count === 0) {
        const user = await tx.user.findUnique({
          where: { id: current.userId },
          select: { lightningBalanceSats: true },
        });
        return { ...current, balanceSats: user?.lightningBalanceSats || 0, credited: false };
      }

      const updatedUser = await tx.user.update({
        where: { id: current.userId },
        data: { lightningBalanceSats: { increment: current.amountSats } },
        select: { lightningBalanceSats: true },
      });

      await tx.balanceTransaction.create({
        data: {
          userId: current.userId,
          type: 'DEPOSIT',
          amountSats: current.amountSats,
          note: `Lightning deposit ${current.id}`,
          balanceAfter: updatedUser.lightningBalanceSats,
        },
      });

      return { ...current, status: 'SETTLED' as DepositStatus, settledAt: now, balanceSats: updatedUser.lightningBalanceSats, credited: true };
    });

    if (settled.credited) {
      console.log(`[Deposit] Settled ${deposit.id}; credited ${deposit.amountSats} sats to ${deposit.userId}`);
    }

    return {
      id: settled.id,
      status: settled.status,
      amountSats: settled.amountSats,
      expiresAt: settled.expiresAt,
      settledAt: settled.settledAt,
      balanceSats: settled.balanceSats,
    };
  }

  if (lookupSucceeded && deposit.expiresAt < new Date()) {
    const expired = await prisma.lightningDeposit.update({
      where: { id: deposit.id },
      data: { status: 'EXPIRED' },
      select: { id: true, status: true, amountSats: true, expiresAt: true, settledAt: true, user: { select: { lightningBalanceSats: true } } },
    });

    return {
      id: expired.id,
      status: expired.status,
      amountSats: expired.amountSats,
      expiresAt: expired.expiresAt,
      settledAt: expired.settledAt,
      balanceSats: expired.user.lightningBalanceSats,
    };
  }

  return {
    id: deposit.id,
    status: 'PENDING',
    amountSats: deposit.amountSats,
    expiresAt: deposit.expiresAt,
    settledAt: deposit.settledAt,
    balanceSats: deposit.user.lightningBalanceSats,
  };
}

export async function getDepositStatus(userId: string, depositId: string): Promise<DepositStatusResponse> {
  const deposit = await prisma.lightningDeposit.findUnique({
    where: { id: depositId },
    select: { userId: true },
  });

  if (!deposit) {
    throw new Error('Deposit not found');
  }

  if (deposit.userId !== userId) {
    throw new Error('Not authorized');
  }

  return settleDepositIfPaid(depositId);
}

export async function getUserDeposits(userId: string, limit: number = 25) {
  return prisma.lightningDeposit.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      amountSats: true,
      status: true,
      expiresAt: true,
      settledAt: true,
      createdAt: true,
    },
  });
}

/**
 * Best-effort background sweep so paid invoices still credit if users close the tab.
 */
export async function checkPendingDeposits(): Promise<{ checked: number; settled: number; expired: number; failed: number }> {
  if (!isVoltageConfigured()) {
    return { checked: 0, settled: 0, expired: 0, failed: 0 };
  }

  const pending = await prisma.lightningDeposit.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: PENDING_SETTLEMENT_BATCH_SIZE,
    select: { id: true, status: true },
  });

  let settled = 0;
  let expired = 0;
  let failed = 0;

  for (const deposit of pending) {
    try {
      const result = await settleDepositIfPaid(deposit.id);
      if (result.status === 'SETTLED') settled += 1;
      if (result.status === 'EXPIRED') expired += 1;
      if (result.status === 'FAILED') failed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[Deposit] Background check failed for ${deposit.id}:`, error);
    }
  }

  if (pending.length > 0) {
    console.log(`[Deposit] Sweep checked ${pending.length}; settled=${settled}, expired=${expired}, failed=${failed}`);
  }

  return { checked: pending.length, settled, expired, failed };
}
