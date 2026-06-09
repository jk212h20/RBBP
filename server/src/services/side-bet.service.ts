/**
 * Side Bet Service
 * 
 * User-created betting pools. Creator sets label & entry cost,
 * pays to enter (initiating the bet), other users join by paying Lightning.
 * Users can enter the same pool multiple times.
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
    description?: string;
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

    const creator = await prisma.user.findUnique({
      where: { id: data.creatorId },
      select: { id: true, lightningBalanceSats: true },
    });
    if (!creator) throw new Error('User not found');

    // Create the side bet. If the creator has enough site balance, debit it and activate immediately.
    if (creator.lightningBalanceSats >= data.entrySats) {
      const result = await prisma.$transaction(async (tx) => {
        const sideBet = await tx.sideBet.create({
          data: {
            label: data.label.trim(),
            description: data.description?.trim() || null,
            creatorId: data.creatorId,
            eventId: data.eventId || null,
            entrySats: data.entrySats,
            feePct,
          },
        });

        const debit = await tx.user.updateMany({
          where: { id: data.creatorId, lightningBalanceSats: { gte: data.entrySats } },
          data: { lightningBalanceSats: { decrement: data.entrySats } },
        });
        if (debit.count !== 1) throw new Error('Insufficient balance');

        const updatedUser = await tx.user.findUnique({
          where: { id: data.creatorId },
          select: { lightningBalanceSats: true },
        });

        await tx.sideBetEntry.create({
          data: {
            sideBetId: sideBet.id,
            userId: data.creatorId,
            amountSats: data.entrySats,
            paidAt: new Date(),
          },
        });

        await tx.balanceTransaction.create({
          data: {
            userId: data.creatorId,
            type: 'SIDE_BET_ENTRY',
            amountSats: data.entrySats,
            note: `Side Bet entry: "${sideBet.label}"`,
            balanceAfter: updatedUser?.lightningBalanceSats ?? 0,
          },
        });

        return { sideBet, balanceSats: updatedUser?.lightningBalanceSats ?? 0 };
      });

      return {
        sideBet: result.sideBet,
        invoice: null,
        paidWithBalance: true,
        balanceSats: result.balanceSats,
      };
    }

    // Otherwise use the existing direct Lightning invoice flow.
    const sideBet = await prisma.sideBet.create({
      data: {
        label: data.label.trim(),
        description: data.description?.trim() || null,
        creatorId: data.creatorId,
        eventId: data.eventId || null,
        entrySats: data.entrySats,
        feePct,
      },
    });

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
      paidWithBalance: false,
      balanceSats: creator.lightningBalanceSats,
    };
  }

  /**
   * Enter an existing side bet (generate Lightning invoice).
   * Users can enter multiple times — each entry creates a new row.
   */
  async enterSideBet(sideBetId: string, userId: string) {
    const sideBet = await prisma.sideBet.findUnique({
      where: { id: sideBetId },
    });

    if (!sideBet) throw new Error('Side bet not found');
    if (sideBet.status !== 'OPEN') throw new Error('This side bet is no longer open');

    // Check creator has paid (bet is active)
    const creatorPaidEntry = await prisma.sideBetEntry.findFirst({
      where: { sideBetId, userId: sideBet.creatorId, paidAt: { not: null } },
    });
    if (!creatorPaidEntry) {
      throw new Error('This side bet has not been activated yet');
    }

    // Check user doesn't have an outstanding unpaid entry (prevent invoice spam)
    const pendingEntry = await prisma.sideBetEntry.findFirst({
      where: { sideBetId, userId, paidAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lightningBalanceSats: true },
    });
    if (!user) throw new Error('User not found');

    // Prefer site balance when there is enough available.
    if (user.lightningBalanceSats >= sideBet.entrySats) {
      const result = await prisma.$transaction(async (tx) => {
        const debit = await tx.user.updateMany({
          where: { id: userId, lightningBalanceSats: { gte: sideBet.entrySats } },
          data: { lightningBalanceSats: { decrement: sideBet.entrySats } },
        });
        if (debit.count !== 1) throw new Error('Insufficient balance');

        const updatedUser = await tx.user.findUnique({
          where: { id: userId },
          select: { lightningBalanceSats: true },
        });

        await tx.sideBetEntry.create({
          data: {
            sideBetId,
            userId,
            amountSats: sideBet.entrySats,
            paidAt: new Date(),
          },
        });

        await tx.balanceTransaction.create({
          data: {
            userId,
            type: 'SIDE_BET_ENTRY',
            amountSats: sideBet.entrySats,
            note: `Side Bet entry: "${sideBet.label}"`,
            balanceAfter: updatedUser?.lightningBalanceSats ?? 0,
          },
        });

        return { balanceSats: updatedUser?.lightningBalanceSats ?? 0 };
      });

      return {
        invoice: null,
        paidWithBalance: true,
        balanceSats: result.balanceSats,
      };
    }

    const memo = `Side Bet: ${sideBet.label}`;
    const { paymentRequest, paymentHash } = await createInvoice(sideBet.entrySats, memo);

    if (pendingEntry) {
      // Update the existing pending entry with new invoice
      await prisma.sideBetEntry.update({
        where: { id: pendingEntry.id },
        data: { paymentHash, amountSats: sideBet.entrySats },
      });
    } else {
      // Create a new entry
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
      paidWithBalance: false,
      balanceSats: user.lightningBalanceSats,
    };
  }

  /**
   * Check if user's latest pending entry has been paid
   */
  async checkPayment(sideBetId: string, userId: string) {
    // Find the user's most recent unpaid entry for this bet
    const entry = await prisma.sideBetEntry.findFirst({
      where: { sideBetId, userId, paidAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!entry) {
      // No pending entry — maybe they already paid or don't have one
      // Check if they have any paid entries
      const paidEntry = await prisma.sideBetEntry.findFirst({
        where: { sideBetId, userId, paidAt: { not: null } },
        orderBy: { paidAt: 'desc' },
      });
      if (paidEntry) return { paid: true, paidAt: paidEntry.paidAt };
      throw new Error('No entry found');
    }
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
   * Get full details for a side bet.
   * Groups entries by user so we can show how many times each person entered.
   */
  async getSideBet(sideBetId: string) {
    const sb = await prisma.sideBet.findUnique({
      where: { id: sideBetId },
      include: {
        creator: { select: { id: true, name: true } },
        winner: { select: { id: true, name: true } },
        event: { select: { id: true, name: true, slug: true } },
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

    // Group entries by user to get entry counts
    const userEntryMap = new Map<string, { userId: string; userName: string; entryCount: number; firstPaidAt: Date | null }>();
    for (const e of sb.entries) {
      const existing = userEntryMap.get(e.userId);
      if (existing) {
        existing.entryCount += 1;
      } else {
        userEntryMap.set(e.userId, {
          userId: e.userId,
          userName: e.user.name,
          entryCount: 1,
          firstPaidAt: e.paidAt,
        });
      }
    }

    // Flat list of every entry (for backwards compat) plus grouped participants
    const participants = Array.from(userEntryMap.values()).map(p => ({
      userId: p.userId,
      userName: p.userName,
      entryCount: p.entryCount,
      paidAt: p.firstPaidAt,
    }));

    return {
      id: sb.id,
      label: sb.label,
      description: sb.description,
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
      entries: participants.map(p => ({
        id: p.userId,
        userId: p.userId,
        userName: p.userName,
        entryCount: p.entryCount,
        paidAt: p.paidAt,
      })),
    };
  }

  /**
   * List ALL side bets (admin view) — shows open, settled, and cancelled
   */
  async listAll() {
    const bets = await prisma.sideBet.findMany({
      include: {
        creator: { select: { id: true, name: true } },
        event: { select: { id: true, name: true, slug: true } },
        winner: { select: { id: true, name: true } },
        entries: {
          where: { paidAt: { not: null } },
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bets.map(b => {
      // Group entries by user
      const userMap = new Map<string, { userId: string; userName: string; entryCount: number }>();
      for (const e of b.entries) {
        const existing = userMap.get(e.userId);
        if (existing) {
          existing.entryCount += 1;
        } else {
          userMap.set(e.userId, { userId: e.userId, userName: e.user.name, entryCount: 1 });
        }
      }

      return {
        id: b.id,
        label: b.label,
        description: b.description,
        creator: b.creator,
        event: b.event,
        winner: b.winner,
        entrySats: b.entrySats,
        feePct: b.feePct,
        status: b.status,
        entryCount: b.entries.length,
        participantCount: userMap.size,
        totalPot: b.entries.reduce((s, e) => s + e.amountSats, 0),
        createdAt: b.createdAt,
        settledAt: b.settledAt,
        participants: Array.from(userMap.values()),
      };
    });
  }

  /**
   * Admin settle — admin can settle any bet (bypasses creator check)
   */
  async adminSettleSideBet(sideBetId: string, winnerId: string) {
    const sideBet = await prisma.sideBet.findUnique({
      where: { id: sideBetId },
      include: {
        entries: { where: { paidAt: { not: null } } },
      },
    });

    if (!sideBet) throw new Error('Side bet not found');
    if (sideBet.status !== 'OPEN') throw new Error('This bet is already settled or cancelled');

    // Winner must be a paid participant
    const winnerEntry = sideBet.entries.find(e => e.userId === winnerId);
    if (!winnerEntry) throw new Error('Winner must be a paid participant');

    const totalPot = sideBet.entries.reduce((s, e) => s + e.amountSats, 0);
    const feeAmount = Math.floor(totalPot * sideBet.feePct / 100);
    const prizeAmount = totalPot - feeAmount;

    let feeAccountId: string | null = null;
    if (feeAmount > 0) {
      const feeAccount = await getFeeAccount();
      feeAccountId = feeAccount.id;
    }

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

    const winner = await prisma.user.findUnique({ where: { id: winnerId }, select: { name: true, lightningBalanceSats: true } });
    await prisma.balanceTransaction.create({
      data: {
        userId: winnerId,
        type: 'CREDIT',
        amountSats: prizeAmount,
        note: `Side Bet won (admin settled): "${sideBet.label}"`,
        balanceAfter: winner?.lightningBalanceSats || prizeAmount,
      },
    });

    return {
      message: `Winner selected by admin! ${prizeAmount} sats credited to ${winner?.name || 'winner'}`,
      winnerId,
      winnerName: winner?.name || 'Unknown',
      prizeAmount,
      feeAmount,
    };
  }

  /**
   * Admin cancel — admin can cancel any bet (bypasses creator check)
   */
  async adminCancelSideBet(sideBetId: string) {
    const sideBet = await prisma.sideBet.findUnique({
      where: { id: sideBetId },
      include: {
        entries: { where: { paidAt: { not: null } } },
      },
    });

    if (!sideBet) throw new Error('Side bet not found');
    if (sideBet.status !== 'OPEN') throw new Error('This bet is already settled or cancelled');

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

    for (const entry of sideBet.entries) {
      const user = await prisma.user.findUnique({ where: { id: entry.userId }, select: { lightningBalanceSats: true } });
      await prisma.balanceTransaction.create({
        data: {
          userId: entry.userId,
          type: 'REFUND',
          amountSats: entry.amountSats,
          note: `Side Bet cancelled by admin: "${sideBet.label}"`,
          balanceAfter: user?.lightningBalanceSats || entry.amountSats,
        },
      });
    }

    return {
      message: `Side bet cancelled by admin. ${sideBet.entries.length} entries refunded.`,
      refundedCount: sideBet.entries.length,
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
        event: { select: { id: true, name: true, slug: true } },
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
        event: { select: { id: true, name: true, slug: true } },
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
        event: { select: { id: true, name: true, slug: true } },
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
        event: { select: { id: true, name: true, slug: true } },
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

    // Refund all paid entries (each entry individually — a user with 3 entries gets 3 refunds)
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
