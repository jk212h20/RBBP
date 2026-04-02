/**
 * Side Bet Service
 * 
 * User-created betting pools. Creator sets label & entry cost,
 * pays to enter (initiating the bet), other users join by paying Lightning.
 * Creator picks the single winner. Platform takes a configurable fee (default 0%).
 * Fee is credited to a special "FEE" account for accounting.
 */

import prisma from '../lib/prisma';
import { createInvoice, lookupInvoice } from './voltage.service';

// Well-known FEE account name — created lazily on first use
const FEE_ACCOUNT_NAME = '__FEE_ACCOUNT__';

/** Default fee percentage (0%) — overridable via env or admin endpoint */
export function getSideBetFeePct(): number {
  return parseFloat(process.env.SIDE_BET_FEE_PCT || '0');
}

/** Get or create the special FEE user for accounting */
async function getFeeAccount() {
  let feeUser = await prisma.user.findFirst({
    where: { name: FEE_ACCOUNT_NAME, isActive: false },
  });
  if (!feeUser) {
    feeUser = await prisma.user.create({
      data: {
        name: FEE_ACCOUNT_NAME,
        isActive: false,
        isGuest: true,
        authProvider: 'EMAIL',
      },
    });
  }
  return feeUser;
}

export class SideBetService {
  /**
   * Create a new side bet AND generate the creator's entry invoice.
   * The bet only becomes visible once the creator pays.
   */
  async createSideBet(data: {
    label: string;
    entrySats: number;
    creatorId: string;
    eventId?: string;
  }) {
    if (!data.label || data.label.trim().length < 2) {
      throw new Error('Label must be at least 2 characters');
    }
    if (data.entrySats < 100) {
      throw new Error('Minimum entry is 100 sats');
    }

    // Validate event exists if provided
    if (data.eventId) {
      const event = await prisma.event.findUnique({ where: { id: data.eventId } });
      if (!event) throw new Error('Event not found');
    }

    const feePct = getSideBetFeePct();

    // Create the side bet
    const sideBet = await prisma.sideBet.create({
      data: {
        label: data.label.trim(),
        creatorId: data.creatorId,
        eventId: data.eventId || null,
        entrySats: data.entrySats,
        feePct,
      },
    });

    // Create creator's entry + Lightning invoice
    const memo = `Side Bet: ${sideBet.label}`;
    const { paymentRequest, paymentHash } = await createInvoice(data.entrySats, memo);

    await prisma.sideBetEntry.create({
      data: {
        sideBetId: sideBet.id,
        userId: data.creatorId,
        amountSats: data.entrySats,
        paymentHash,
      },
    });

    return {
      sideBet,
      invoice: {
        paymentRequest,
        paymentHash,
        amountSats: data.entrySats,
      },
    };
  }

  /**
   * Enter an existing side bet (generate Lightning invoice)
   */
  async enterSideBet(sideBetId: string, userId: string) {
    const sideBet = await prisma.sideBet.findUnique({
      where: { id: sideBetId },
      include: {
        entries: { where: { paidAt: { not: null } }, select: { id: true } },
      },
    });

    if (!sideBet) throw new Error('Side bet not found');
    if (sideBet.status !== 'OPEN') throw new Error('This side bet is no longer open');

    // Check creator has paid (bet is active)
    const creatorEntry = await prisma.sideBetEntry.findUnique({
      where: { sideBetId_userId: { sideBetId, userId: sideBet.creatorId } },
    });
    if (!creatorEntry?.paidAt) {
      throw new Error('This side bet has not been activated yet');
    }

    // Check not already entered
    const existing = await prisma.sideBetEntry.findUnique({
      where: { sideBetId_userId: { sideBetId, userId } },
    });
    if (existing?.paidAt) {
      throw new Error('You have already entered this side bet');
    }

    const memo = `Side Bet: ${sideBet.label}`;
    const { paymentRequest, paymentHash } = await createInvoice(sideBet.entrySats, memo);

    // Upsert entry
    if (existing) {
      await prisma.sideBetEntry.update({
        where: { id: existing.id },
        data: { paymentHash, amountSats: sideBet.entrySats },
      });
    } else {
      await prisma.sideBetEntry.create({
        data: {
          sideBetId,
          userId,
          amountSats: sideBet.entrySats,
          paymentHash,
        },
      });
    }

    return {
      invoice: {
        paymentRequest,
        paymentHash,
        amountSats: sideBet.entrySats,
      },
    };
  }

  /**
   * Check if user's entry has been paid
   */
  async checkPayment(sideBetId: string, userId: string) {
    const entry = await prisma.sideBetEntry.findUnique({
      where: { sideBetId_userId: { sideBetId, userId } },
    });
    if (!entry) throw new Error('No entry found');
    if (entry.paidAt) return { paid: true, paidAt: entry.paidAt };
    if (!entry.paymentHash) return { paid: false };

    const { settled } = await lookupInvoice(entry.paymentHash);
    if (settled) {
      await prisma.sideBetEntry.update({
        where: { id: entry.id },
        data: { paidAt: new Date() },
      });
      return { paid: true, paidAt: new Date() };
    }
    return { paid: false };
  }

  /**
   * Get full details for a side bet
   */
  async getSideBet(sideBetId: string) {
    const sb = await prisma.sideBet.findUnique({
      where: { id: sideBetId },
      include: {
        creator: { select: { id: true, name: true } },
        winner: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
        entries: {
          where: { paidAt: { not: null } },
          include: { user: { select: { id: true, name: true } } },
          orderBy: { paidAt: 'asc' },
        },
      },
    });
    if (!sb) throw new Error('Side bet not found');

    const totalPot = sb.entries.reduce((sum, e) => sum + e.amountSats, 0);
    const feeAmount = Math.floor(totalPot * sb.feePct / 100);
    const prizeAmount = totalPot - feeAmount;

    return {
      id: sb.id,
      label: sb.label,
      creator: sb.creator,
      event: sb.event,
      entrySats: sb.entrySats,
      feePct: sb.feePct,
      status: sb.status,
      winner: sb.winner,
      settledAt: sb.settledAt,
      createdAt: sb.createdAt,
      entryCount: sb.entries.length,
      totalPot,
      feeAmount,
      prizeAmount,
      entries: sb.entries.map(e => ({
        id: e.id,
        userId: e.userId,
        userName: e.user.name,
        paidAt: e.paidAt,
      })),
    };
  }

  /**
   * List open side bets, optionally filtered by eventId
   */
  async listOpen(eventId?: string) {
    const where: any = {
      status: 'OPEN',
      // Only show bets where creator has paid
      entries: { some: { paidAt: { not: null } } },
    };
    if (eventId) where.eventId = eventId;

    const bets = await prisma.sideBet.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
        entries: { where: { paidAt: { not: null } }, select: { amountSats: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bets.map(b => ({
      id: b.id,
      label: b.label,
      creator: b.creator,
      event: b.event,
      entrySats: b.entrySats,
      status: b.status,
      entryCount: b.entries.length,
      totalPot: b.entries.reduce((s, e) => s + e.amountSats, 0),
      createdAt: b.createdAt,
    }));
  }

  /**
   * Get bets a user has created or entered (active + completed)
   */
  async getUserBets(userId: string) {
    // Bets created by user
    const created = await prisma.sideBet.findMany({
      where: { creatorId: userId },
      include: {
        event: { select: { id: true, name: true } },
        winner: { select: { id: true, name: true } },
        entries: { where: { paidAt: { not: null } }, select: { amountSats: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Bets entered by user (but not created)
    const entered = await prisma.sideBet.findMany({
      where: {
        entries: { some: { userId, paidAt: { not: null } } },
        creatorId: { not: userId },
      },
      include: {
        creator: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
        winner: { select: { id: true, name: true } },
        entries: { where: { paidAt: { not: null } }, select: { amountSats: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mapBet = (b: any) => ({
      id: b.id,
      label: b.label,
      creator: b.creator || undefined,
      event: b.event,
      entrySats: b.entrySats,
      status: b.status,
      winner: b.winner,
      entryCount: b.entries.length,
      totalPot: b.entries.reduce((s: number, e: any) => s + e.amountSats, 0),
      createdAt: b.createdAt,
      settledAt: b.settledAt,
    });

    return {
      created: created.map(mapBet),
      entered: entered.map(mapBet),
    };
  }

  /**
   * Get public bets for a player profile (active + settled, only paid-visible bets)
   */
  async getPlayerBets(userId: string) {
    const bets = await prisma.sideBet.findMany({
      where: {
        entries: { some: { userId, paidAt: { not: null } } },
        // Only show bets that are activated (creator paid)
        AND: {
          entries: { some: { paidAt: { not: null } } },
        },
      },
      include: {
        creator: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
        winner: { select: { id: true, name: true } },
        entries: { where: { paidAt: { not: null } }, select: { amountSats: true, userId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return bets.map(b => ({
      id: b.id,
      label: b.label,
      creator: b.creator,
      event: b.event,
      entrySats: b.entrySats,
      status: b.status,
      winner: b.winner,
      entryCount: b.entries.length,
      totalPot: b.entries.reduce((s, e) => s + e.amountSats, 0),
      createdAt: b.createdAt,
      settledAt: b.settledAt,
      isCreator: b.creator.id === userId,
    }));
  }

  /**
   * Creator settles the bet — pick the winner.
   * Prize = totalPot - fee. Fee credited to FEE account.
   */
  async settleSideBet(sideBetId: string, winnerId: string, callerId: string) {
    const sideBet = await prisma.sideBet.findUnique({
      where: { id: sideBetId },
      include: {
        entries: { where: { paidAt: { not: null } } },
      },
    });

    if (!sideBet) throw new Error('Side bet not found');
    if (sideBet.creatorId !== callerId) throw new Error('Only the creator can settle this bet');
    if (sideBet.status !== 'OPEN') throw new Error('This bet is already settled or cancelled');

    // Winner must be a paid participant
    const winnerEntry = sideBet.entries.find(e => e.userId === winnerId);
    if (!winnerEntry) throw new Error('Winner must be a paid participant');

    const totalPot = sideBet.entries.reduce((s, e) => s + e.amountSats, 0);
    const feeAmount = Math.floor(totalPot * sideBet.feePct / 100);
    const prizeAmount = totalPot - feeAmount;

    // Get fee account if there's a fee
    let feeAccountId: string | null = null;
    if (feeAmount > 0) {
      const feeAccount = await getFeeAccount();
      feeAccountId = feeAccount.id;
    }

    // Atomic transaction: settle bet, credit winner, credit fee account
    const txOps: any[] = [
      prisma.sideBet.update({
        where: { id: sideBetId },
        data: { status: 'SETTLED', winnerId, settledAt: new Date() },
      }),
      prisma.user.update({
        where: { id: winnerId },
        data: { lightningBalanceSats: { increment: prizeAmount } },
      }),
    ];

    if (feeAmount > 0 && feeAccountId) {
      txOps.push(
        prisma.user.update({
          where: { id: feeAccountId },
          data: { lightningBalanceSats: { increment: feeAmount } },
        })
      );
    }

    await prisma.$transaction(txOps);

    // Create balance transaction records (outside main tx for non-critical audit)
    const winner = await prisma.user.findUnique({ where: { id: winnerId }, select: { name: true, lightningBalanceSats: true } });
    await prisma.balanceTransaction.create({
      data: {
        userId: winnerId,
        type: 'CREDIT',
        amountSats: prizeAmount,
        note: `Side Bet won: "${sideBet.label}"`,
        balanceAfter: winner?.lightningBalanceSats || prizeAmount,
      },
    });

    if (feeAmount > 0 && feeAccountId) {
      const feeUser = await prisma.user.findUnique({ where: { id: feeAccountId }, select: { lightningBalanceSats: true } });
      await prisma.balanceTransaction.create({
        data: {
          userId: feeAccountId,
          type: 'CREDIT',
          amountSats: feeAmount,
          note: `Side Bet fee: "${sideBet.label}"`,
          balanceAfter: feeUser?.lightningBalanceSats || feeAmount,
        },
      });
    }

    return {
      message: `Winner selected! ${prizeAmount} sats credited to ${winner?.name || 'winner'}`,
      winnerId,
      winnerName: winner?.name || 'Unknown',
      prizeAmount,
      feeAmount,
    };
  }

  /**
   * Cancel a side bet — refund all paid entries to their balances
   */
  async cancelSideBet(sideBetId: string, callerId: string) {
    const sideBet = await prisma.sideBet.findUnique({
      where: { id: sideBetId },
      include: {
        entries: { where: { paidAt: { not: null } } },
      },
    });

    if (!sideBet) throw new Error('Side bet not found');
    if (sideBet.creatorId !== callerId) throw new Error('Only the creator can cancel this bet');
    if (sideBet.status !== 'OPEN') throw new Error('This bet is already settled or cancelled');

    // Refund all paid entries
    const txOps: any[] = [
      prisma.sideBet.update({
        where: { id: sideBetId },
        data: { status: 'CANCELLED' },
      }),
    ];

    for (const entry of sideBet.entries) {
      txOps.push(
        prisma.user.update({
          where: { id: entry.userId },
          data: { lightningBalanceSats: { increment: entry.amountSats } },
        })
      );
    }

    await prisma.$transaction(txOps);

    // Create refund transaction records
    for (const entry of sideBet.entries) {
      const user = await prisma.user.findUnique({ where: { id: entry.userId }, select: { lightningBalanceSats: true } });
      await prisma.balanceTransaction.create({
        data: {
          userId: entry.userId,
          type: 'REFUND',
          amountSats: entry.amountSats,
          note: `Side Bet cancelled: "${sideBet.label}"`,
          balanceAfter: user?.lightningBalanceSats || entry.amountSats,
        },
      });
    }

    return {
      message: `Side bet cancelled. ${sideBet.entries.length} entries refunded.`,
      refundedCount: sideBet.entries.length,
    };
  }
}

export const sideBetService = new SideBetService();
