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
import { EventStatus } from '@prisma/client';
import { createInvoice, lookupInvoice } from './voltage.service';

// Well-known FEE account name — created lazily on first use
const FEE_ACCOUNT_NAME = '__FEE_ACCOUNT__';
const SIDE_BET_SYSTEM_ACCOUNT_NAME = '__SIDE_BET_SYSTEM__';
const EVENT_SIDE_BET_DEFAULT_ENTRY_SATS = parseInt(process.env.EVENT_SIDE_BET_ENTRY_SATS || '30000', 10);
const EVENT_SIDE_BET_HOME_LOOKAHEAD_MINUTES = parseInt(process.env.EVENT_SIDE_BET_HOME_LOOKAHEAD_MINUTES || '15', 10);
const EVENT_SIDE_BET_HOME_GRACE_HOURS = parseInt(process.env.EVENT_SIDE_BET_HOME_GRACE_HOURS || '6', 10);

function eventSideBetLabel(eventName: string): string {
  return `Side Bet: ${eventName}`;
}

function eventSideBetDescription(entrySats: number): string {
  return `Automatic event side bet. Highest-finishing entrants split the pot: with 7+ players, 3rd gets one ${entrySats.toLocaleString()} sats entry back, then 2nd gets 30% and 1st gets 70% of the remainder. With 3–6 players, 2nd gets 30% and 1st gets 70%. With 1–2 players, 1st gets the full pot.`;
}

export interface EventSideBetResultInput {
  userId: string;
  position: number;
  user?: { id: string; name: string };
}

export interface EventSideBetPreviewPayout {
  userId: string;
  userName: string;
  position: number;
  place: 1 | 2 | 3;
  amountSats: number;
}

function requiredEventSideBetPlaces(participantCount: number): number {
  if (participantCount <= 0) return 0;
  if (participantCount <= 2) return 1;
  if (participantCount <= 6) return 2;
  return 3;
}

function buildEventSideBetPreview(sideBet: {
  entrySats: number;
  feePct: number;
  entries: Array<{ userId: string; amountSats: number; user?: { id: string; name: string } }>;
}, rawResults: EventSideBetResultInput[]) {
  const totalPot = sideBet.entries.reduce((s, e) => s + e.amountSats, 0);
  const feeAmount = Math.floor(totalPot * sideBet.feePct / 100);
  const prizePool = totalPot - feeAmount;

  const paidUserMap = new Map<string, string>();
  for (const entry of sideBet.entries) {
    if (!paidUserMap.has(entry.userId)) {
      paidUserMap.set(entry.userId, entry.user?.name || 'Unknown');
    }
  }

  const participantCount = paidUserMap.size;
  const requiredPlaces = requiredEventSideBetPlaces(participantCount);
  const paidUserIds = new Set(paidUserMap.keys());
  const rankedResults = rawResults
    .filter(r => paidUserIds.has(r.userId))
    .sort((a, b) => a.position - b.position);
  const ready = participantCount > 0 && rankedResults.length >= requiredPlaces;
  const missingResultUserIds = Array.from(paidUserMap.keys()).filter(
    userId => !rankedResults.some(r => r.userId === userId)
  );

  const payouts: EventSideBetPreviewPayout[] = [];
  if (ready) {
    if (participantCount <= 2) {
      const first = rankedResults[0];
      payouts.push({ userId: first.userId, userName: first.user?.name || paidUserMap.get(first.userId) || 'Unknown', position: first.position, place: 1, amountSats: prizePool });
    } else if (participantCount <= 6) {
      const secondAmount = Math.floor(prizePool * 0.30);
      const firstAmount = prizePool - secondAmount;
      const first = rankedResults[0];
      const second = rankedResults[1];
      payouts.push({ userId: first.userId, userName: first.user?.name || paidUserMap.get(first.userId) || 'Unknown', position: first.position, place: 1, amountSats: firstAmount });
      payouts.push({ userId: second.userId, userName: second.user?.name || paidUserMap.get(second.userId) || 'Unknown', position: second.position, place: 2, amountSats: secondAmount });
    } else {
      const thirdRefund = Math.min(sideBet.entrySats, prizePool);
      const remainder = prizePool - thirdRefund;
      const secondAmount = Math.floor(remainder * 0.30);
      const firstAmount = remainder - secondAmount;
      const first = rankedResults[0];
      const second = rankedResults[1];
      const third = rankedResults[2];
      payouts.push({ userId: first.userId, userName: first.user?.name || paidUserMap.get(first.userId) || 'Unknown', position: first.position, place: 1, amountSats: firstAmount });
      payouts.push({ userId: second.userId, userName: second.user?.name || paidUserMap.get(second.userId) || 'Unknown', position: second.position, place: 2, amountSats: secondAmount });
      payouts.push({ userId: third.userId, userName: third.user?.name || paidUserMap.get(third.userId) || 'Unknown', position: third.position, place: 3, amountSats: thirdRefund });
    }
  }

  return {
    totalPot,
    feeAmount,
    prizePool,
    participantCount,
    requiredPlaces,
    paidResultCount: rankedResults.length,
    ready,
    missingResultUserIds,
    rankedResults: rankedResults.map(r => ({ userId: r.userId, userName: r.user?.name || paidUserMap.get(r.userId) || 'Unknown', position: r.position })),
    payouts: payouts.filter(p => p.amountSats > 0),
  };
}

/** Default fee percentage (0%) — overridable via env or admin endpoint */
export function getSideBetFeePct(): number {
  return parseFloat(process.env.SIDE_BET_FEE_PCT || '0');
}

/** Get or create the system user that owns automatic event side bets */
async function getSideBetSystemAccount() {
  let systemUser = await prisma.user.findFirst({
    where: { name: SIDE_BET_SYSTEM_ACCOUNT_NAME, isActive: false },
  });
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        name: SIDE_BET_SYSTEM_ACCOUNT_NAME,
        isActive: false,
        isGuest: true,
        authProvider: 'EMAIL',
      },
    });
  }
  return systemUser;
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
  async ensureEventSideBet(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, name: true, status: true },
    });
    if (!event) throw new Error('Event not found');

    const systemUser = await getSideBetSystemAccount();
    const existing = await prisma.sideBet.findFirst({
      where: { eventId: event.id, creatorId: systemUser.id },
      orderBy: { createdAt: 'asc' },
    });
    const entrySats = EVENT_SIDE_BET_DEFAULT_ENTRY_SATS;
    if (existing) {
      if (existing.status === 'OPEN' && existing.entrySats !== entrySats) {
        const entryCount = await prisma.sideBetEntry.count({ where: { sideBetId: existing.id } });
        if (entryCount === 0) {
          const updated = await prisma.sideBet.update({
            where: { id: existing.id },
            data: {
              entrySats,
              description: eventSideBetDescription(entrySats),
            },
          });
          console.log(`[SideBet] Updated empty automatic event side bet entry amount: event=${event.id} sideBet=${existing.id} entrySats=${entrySats}`);
          return updated;
        }
        console.log(`[SideBet] Leaving existing automatic event side bet amount unchanged because it already has entries: event=${event.id} sideBet=${existing.id} existingEntrySats=${existing.entrySats} desiredEntrySats=${entrySats} entryCount=${entryCount}`);
      }
      return existing;
    }
    if (event.status === EventStatus.COMPLETED || event.status === EventStatus.CANCELLED) {
      return null;
    }

    try {
      const sideBet = await prisma.sideBet.create({
        data: {
          // Deterministic id prevents duplicate automatic side bets if two
          // requests try to create the event side bet at the same time.
          id: `event-side-bet-${event.id}`,
          label: eventSideBetLabel(event.name),
          description: eventSideBetDescription(entrySats),
          creatorId: systemUser.id,
          eventId: event.id,
          entrySats,
          feePct: getSideBetFeePct(),
        },
      });
      console.log(`[SideBet] Created automatic event side bet: event=${event.id} sideBet=${sideBet.id} entrySats=${entrySats}`);
      return sideBet;
    } catch (error) {
      const racedExisting = await prisma.sideBet.findFirst({
        where: { eventId: event.id, creatorId: systemUser.id },
        orderBy: { createdAt: 'asc' },
      });
      if (racedExisting) return racedExisting;
      throw error;
    }
  }

  async ensureEventSideBetsForUpcoming(limit = 100) {
    const events = await prisma.event.findMany({
      where: {
        dateTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        status: { in: [EventStatus.SCHEDULED, EventStatus.REGISTRATION_OPEN] },
      },
      select: { id: true },
      orderBy: { dateTime: 'asc' },
      take: limit,
    });

    for (const event of events) {
      try {
        await this.ensureEventSideBet(event.id);
      } catch (error) {
        console.error(`[SideBet] Failed to ensure automatic event side bet: event=${event.id}`, error);
      }
    }
  }

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

    // Legacy user-created side bets only become active after the creator pays.
    // Automatic event side bets are created/visible before anyone enters.
    if (!sideBet.eventId) {
      const creatorPaidEntry = await prisma.sideBetEntry.findFirst({
        where: { sideBetId, userId: sideBet.creatorId, paidAt: { not: null } },
      });
      if (!creatorPaidEntry) {
        throw new Error('This side bet has not been activated yet');
      }
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
      console.log(`[SideBet] Charging entry from balance: sideBet=${sideBetId} user=${userId} amount=${sideBet.entrySats} pendingInvoice=${pendingEntry?.id || 'none'}`);
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

    // Important: create a new pending row for every Lightning invoice.
    // Do NOT overwrite an existing pending entry's paymentHash. A player may
    // already have an invoice open in a wallet; if we replace that hash and
    // they pay the old invoice, we can no longer match their payment to an
    // entry. Multiple unpaid pending rows are harmless; only settled invoices
    // are counted in pots/participants.
    const createdEntry = await prisma.sideBetEntry.create({
      data: {
        sideBetId,
        userId,
        amountSats: sideBet.entrySats,
        paymentHash,
      },
    });
    console.log(`[SideBet] Created Lightning entry invoice: sideBet=${sideBetId} entry=${createdEntry.id} user=${userId} amount=${sideBet.entrySats} hash=${paymentHash.substring(0, 16)}... priorPending=${pendingEntry?.id || 'none'}`);

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
   * Check if any of the user's pending side bet invoices have been paid.
   *
   * A user can have multiple outstanding invoices for the same side bet if
   * they re-open the entry flow or request multiple rebuys. We must check all
   * unpaid invoice-backed entries, not just the newest one; otherwise an older
   * invoice can be paid after a newer invoice was generated and the sats will
   * be received by the node but never credited to the side pool.
   */
  async checkPayment(sideBetId: string, userId: string) {
    const pendingEntries = await prisma.sideBetEntry.findMany({
      where: { sideBetId, userId, paidAt: null, paymentHash: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    let latestPaidEntry: { paidAt: Date | null } | null = null;
    let lookupFailures = 0;

    for (const entry of pendingEntries) {
      try {
        console.log(`[SideBet] Checking invoice: sideBet=${sideBetId} entry=${entry.id} user=${userId} hash=${entry.paymentHash?.substring(0, 16)}...`);
        const { settled, amountPaidSats } = await lookupInvoice(entry.paymentHash!);
        console.log(`[SideBet] Invoice lookup result: sideBet=${sideBetId} entry=${entry.id} settled=${settled} amountPaidSats=${amountPaidSats}`);

        if (settled) {
          const updated = await prisma.sideBetEntry.update({
            where: { id: entry.id },
            data: { paidAt: new Date() },
          });
          latestPaidEntry = updated;
          console.log(`[SideBet] Marked entry paid: sideBet=${sideBetId} entry=${entry.id} user=${userId} amount=${entry.amountSats}`);
        }
      } catch (error) {
        lookupFailures += 1;
        console.error(`[SideBet] Invoice lookup failed: sideBet=${sideBetId} entry=${entry.id} user=${userId} hash=${entry.paymentHash?.substring(0, 16)}...`, error);
      }
    }

    if (latestPaidEntry) {
      return { paid: true, paidAt: latestPaidEntry.paidAt };
    }

    if (pendingEntries.length > 0) {
      return { paid: false, pendingCount: pendingEntries.length, lookupFailures };
    }

    // No pending invoice entries — maybe they already paid with balance or a
    // previously checked Lightning invoice.
    const paidEntry = await prisma.sideBetEntry.findFirst({
      where: { sideBetId, userId, paidAt: { not: null } },
      orderBy: { paidAt: 'desc' },
    });
    if (paidEntry) return { paid: true, paidAt: paidEntry.paidAt };

    throw new Error('No entry found');
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
        event: { select: { id: true, name: true, slug: true, dateTime: true } },
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
        event: { select: { id: true, name: true, slug: true, dateTime: true } },
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
        event: b.event ? { id: b.event.id, name: b.event.name, slug: b.event.slug, dateTime: b.event.dateTime } : null,
        winner: b.winner,
        entrySats: b.entrySats,
        feePct: b.feePct,
        status: b.status,
        entryCount: b.entries.length,
        participantCount: userMap.size,
        totalPot: b.entries.reduce((s, e) => s + e.amountSats, 0),
        createdAt: b.createdAt,
        startsAt: b.event?.dateTime || null,
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

  async previewEventSideBetSettlement(eventId: string, resultInputs?: EventSideBetResultInput[]) {
    const systemUser = await getSideBetSystemAccount();
    const sideBet = await prisma.sideBet.findFirst({
      where: { eventId, creatorId: systemUser.id },
      include: {
        event: { select: { name: true } },
        entries: {
          where: { paidAt: { not: null } },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!sideBet) return null;

    const results = resultInputs || await prisma.result.findMany({
      where: { eventId },
      orderBy: { position: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });

    return {
      sideBetId: sideBet.id,
      label: sideBet.label,
      status: sideBet.status,
      eventName: sideBet.event?.name || null,
      entrySats: sideBet.entrySats,
      ...buildEventSideBetPreview(sideBet, results),
    };
  }

  async settleEventSideBet(eventId: string) {
    const systemUser = await getSideBetSystemAccount();
    const sideBet = await prisma.sideBet.findFirst({
      where: { eventId, creatorId: systemUser.id },
      include: {
        event: { select: { name: true } },
        entries: {
          where: { paidAt: { not: null } },
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!sideBet) return null;
    if (sideBet.status !== 'OPEN') return null;
    if (sideBet.entries.length === 0) {
      await prisma.sideBet.update({
        where: { id: sideBet.id },
        data: { status: 'CANCELLED' },
      });
      console.log(`[SideBet] Cancelled empty event side bet: event=${eventId} sideBet=${sideBet.id}`);
      return { message: 'No side bet entries to settle', sideBetId: sideBet.id, payouts: [] };
    }

    const results = await prisma.result.findMany({
      where: { eventId },
      orderBy: { position: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });

    const preview = buildEventSideBetPreview(sideBet, results);
    if (!preview.ready) {
      console.warn(`[SideBet] Cannot settle event side bet yet; event=${eventId} sideBet=${sideBet.id} paidResults=${preview.paidResultCount} required=${preview.requiredPlaces}`);
      return null;
    }

    const totalPot = preview.totalPot;
    const feeAmount = preview.feeAmount;
    const positivePayouts = preview.payouts;
    let feeAccountId: string | null = null;
    if (feeAmount > 0) {
      feeAccountId = (await getFeeAccount()).id;
    }

    await prisma.$transaction(async (tx) => {
      const claim = await tx.sideBet.updateMany({
        where: { id: sideBet.id, status: 'OPEN' },
        data: { status: 'SETTLED', winnerId: positivePayouts[0]?.userId || null, settledAt: new Date() },
      });
      if (claim.count !== 1) return;

      for (const payout of positivePayouts) {
        const updatedUser = await tx.user.update({
          where: { id: payout.userId },
          data: { lightningBalanceSats: { increment: payout.amountSats } },
          select: { lightningBalanceSats: true },
        });
        await tx.balanceTransaction.create({
          data: {
            userId: payout.userId,
            type: 'CREDIT',
            amountSats: payout.amountSats,
            note: `Event Side Bet ${payout.place}${payout.place === 1 ? 'st' : payout.place === 2 ? 'nd' : 'rd'} payout: "${sideBet.event?.name || sideBet.label}"`,
            balanceAfter: updatedUser.lightningBalanceSats,
          },
        });
      }

      if (feeAmount > 0 && feeAccountId) {
        const feeUser = await tx.user.update({
          where: { id: feeAccountId },
          data: { lightningBalanceSats: { increment: feeAmount } },
          select: { lightningBalanceSats: true },
        });
        await tx.balanceTransaction.create({
          data: {
            userId: feeAccountId,
            type: 'CREDIT',
            amountSats: feeAmount,
            note: `Event Side Bet fee: "${sideBet.event?.name || sideBet.label}"`,
            balanceAfter: feeUser.lightningBalanceSats,
          },
        });
      }
    });

    console.log(`[SideBet] Settled event side bet: event=${eventId} sideBet=${sideBet.id} participantCount=${preview.participantCount} totalPot=${totalPot} fee=${feeAmount} payouts=${positivePayouts.map(p => `${p.place}:${p.userId}:${p.amountSats}`).join(',')}`);
    return {
      message: 'Event side bet settled',
      sideBetId: sideBet.id,
      totalPot,
      feeAmount,
      payouts: positivePayouts,
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
    if (eventId) {
      await this.ensureEventSideBet(eventId);
    } else {
      await this.ensureEventSideBetsForUpcoming();
    }

    const systemUser = await getSideBetSystemAccount();
    const where: any = eventId ? {
      status: 'OPEN',
      eventId,
      creatorId: systemUser.id,
    } : {
      status: 'OPEN',
      eventId: { not: null },
      creatorId: systemUser.id,
      // Event side bets show on the home page shortly before the event and
      // for a short grace window after it starts. Without the lower bound, old
      // OPEN event side bets can remain stuck on the home page indefinitely.
      event: {
        is: {
          dateTime: {
            gte: new Date(Date.now() - EVENT_SIDE_BET_HOME_GRACE_HOURS * 60 * 60 * 1000),
            lte: new Date(Date.now() + EVENT_SIDE_BET_HOME_LOOKAHEAD_MINUTES * 60 * 1000),
          },
        },
      },
    };

    const bets = await prisma.sideBet.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        event: { select: { id: true, name: true, slug: true, dateTime: true } },
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
      startsAt: b.event?.dateTime || null,
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

export async function checkPendingSideBetEntries() {
  const pendingEntries = await prisma.sideBetEntry.findMany({
    where: {
      paidAt: null,
      paymentHash: { not: null },
      sideBet: { status: 'OPEN' },
    },
    include: {
      sideBet: { select: { id: true, label: true, entrySats: true, status: true } },
    },
    take: 50,
    orderBy: { createdAt: 'asc' },
  });

  let checked = 0;
  let settled = 0;
  let failed = 0;

  for (const entry of pendingEntries) {
    try {
      checked += 1;
      const invoice = await lookupInvoice(entry.paymentHash!);
      if (!invoice.settled) continue;

      await prisma.sideBetEntry.updateMany({
        where: { id: entry.id, paidAt: null },
        data: { paidAt: new Date() },
      });
      settled += 1;
      console.log(`[SideBet] Background settled entry: sideBet=${entry.sideBetId} entry=${entry.id} user=${entry.userId} amount=${entry.amountSats} amountPaidSats=${invoice.amountPaidSats}`);
    } catch (error) {
      failed += 1;
      console.error(`[SideBet] Background invoice check failed: sideBet=${entry.sideBetId} entry=${entry.id} user=${entry.userId} hash=${entry.paymentHash?.substring(0, 16)}...`, error);
    }
  }

  if (checked > 0 || failed > 0) {
    console.log(`[SideBet] Background check complete: checked=${checked} settled=${settled} failed=${failed}`);
  }

  return { checked, settled, failed };
}

export const sideBetService = new SideBetService();
