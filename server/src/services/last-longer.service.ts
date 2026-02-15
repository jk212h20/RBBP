/**
 * Last Longer Pool Service
 * 
 * Manages the Last Longer side-bet pool for events.
 * Players pay a Lightning invoice to enter the pool.
 * Admin/TD selects the winner who gets all sats credited to their balance.
 */

import prisma from '../lib/prisma';
import { createInvoice, lookupInvoice } from './voltage.service';

export class LastLongerService {
  /**
   * Create a Lightning invoice for a player to enter the Last Longer pool
   */
  async createEntryInvoice(eventId: string, userId: string) {
    // Get event with last longer config
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        name: true,
        lastLongerEnabled: true,
        lastLongerEntrySats: true,
        status: true,
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    if (!event.lastLongerEnabled) {
      throw new Error('Last Longer pool is not enabled for this event');
    }

    // Check user is registered for the event
    const signup = await prisma.eventSignup.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });

    if (!signup) {
      throw new Error('You must be registered for the event to enter the Last Longer pool');
    }

    // Check if already entered
    const existingEntry = await prisma.lastLongerEntry.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });

    if (existingEntry?.paidAt) {
      throw new Error('You have already entered the Last Longer pool for this event');
    }

    // Create Lightning invoice
    const memo = `Last Longer Pool Entry - ${event.name}`;
    const { paymentRequest, paymentHash } = await createInvoice(
      event.lastLongerEntrySats,
      memo,
    );

    // Upsert the entry record (may exist unpaid from a previous attempt)
    if (existingEntry) {
      await prisma.lastLongerEntry.update({
        where: { id: existingEntry.id },
        data: {
          paymentHash,
          amountSats: event.lastLongerEntrySats,
        },
      });
    } else {
      await prisma.lastLongerEntry.create({
        data: {
          eventId,
          userId,
          amountSats: event.lastLongerEntrySats,
          paymentHash,
        },
      });
    }

    return {
      paymentRequest,
      paymentHash,
      amountSats: event.lastLongerEntrySats,
    };
  }

  /**
   * Check if a Last Longer entry invoice has been paid
   */
  async checkPayment(eventId: string, userId: string) {
    const entry = await prisma.lastLongerEntry.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });

    if (!entry) {
      throw new Error('No Last Longer entry found');
    }

    if (entry.paidAt) {
      return { paid: true, paidAt: entry.paidAt };
    }

    if (!entry.paymentHash) {
      return { paid: false };
    }

    // Check with LND if the invoice has been paid
    const { settled } = await lookupInvoice(entry.paymentHash);

    if (settled) {
      // Mark as paid
      await prisma.lastLongerEntry.update({
        where: { id: entry.id },
        data: { paidAt: new Date() },
      });
      return { paid: true, paidAt: new Date() };
    }

    return { paid: false };
  }

  /**
   * Get all entries for an event's Last Longer pool
   */
  async getPoolEntries(eventId: string) {
    return prisma.lastLongerEntry.findMany({
      where: {
        eventId,
        paidAt: { not: null }, // Only paid entries
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        paidAt: 'asc',
      },
    });
  }

  /**
   * Get pool info for an event (total pot, entry count, etc.)
   */
  async getPoolInfo(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        lastLongerEnabled: true,
        lastLongerSeedSats: true,
        lastLongerEntrySats: true,
        lastLongerWinnerId: true,
        lastLongerWinner: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Count paid entries and sum
    const entries = await prisma.lastLongerEntry.findMany({
      where: {
        eventId,
        paidAt: { not: null },
      },
      select: {
        amountSats: true,
      },
    });

    const entryCount = entries.length;
    const totalEntrySats = entries.reduce((sum, e) => sum + e.amountSats, 0);
    const totalPoolSats = event.lastLongerSeedSats + totalEntrySats;

    return {
      enabled: event.lastLongerEnabled,
      seedSats: event.lastLongerSeedSats,
      entrySats: event.lastLongerEntrySats,
      entryCount,
      totalPoolSats,
      winnerId: event.lastLongerWinnerId,
      winner: event.lastLongerWinner,
    };
  }

  /**
   * Select the winner of the Last Longer pool (Admin/TD only)
   * Credits the total pool amount to the winner's lightning balance
   */
  async selectWinner(eventId: string, winnerId: string) {
    // Verify the winner is in the pool
    const entry = await prisma.lastLongerEntry.findUnique({
      where: {
        eventId_userId: { eventId, userId: winnerId },
      },
    });

    if (!entry || !entry.paidAt) {
      throw new Error('Selected winner is not a paid participant in the Last Longer pool');
    }

    // Calculate total pool
    const poolInfo = await this.getPoolInfo(eventId);

    // Check if winner was already selected (prevent double-crediting)
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { lastLongerWinnerId: true, name: true },
    });

    if (event?.lastLongerWinnerId) {
      throw new Error('A winner has already been selected for this Last Longer pool');
    }

    // Credit the winner's balance and set the winner in a transaction
    await prisma.$transaction([
      // Set the winner on the event
      prisma.event.update({
        where: { id: eventId },
        data: { lastLongerWinnerId: winnerId },
      }),
      // Credit the winner's lightning balance
      prisma.user.update({
        where: { id: winnerId },
        data: {
          lightningBalanceSats: {
            increment: poolInfo.totalPoolSats,
          },
        },
      }),
    ]);

    return {
      winnerId,
      totalPoolSats: poolInfo.totalPoolSats,
      eventName: event?.name,
    };
  }

  /**
   * Check if a user has entered the Last Longer pool for an event
   */
  async isUserEntered(eventId: string, userId: string) {
    const entry = await prisma.lastLongerEntry.findUnique({
      where: {
        eventId_userId: { eventId, userId },
      },
    });

    return {
      entered: !!entry?.paidAt,
      pending: !!entry && !entry.paidAt,
    };
  }
}

export const lastLongerService = new LastLongerService();
