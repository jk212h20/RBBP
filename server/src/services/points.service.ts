/**
 * Points Service
 * Manages points awards, deductions, and history tracking.
 * All point changes MUST include a reason for audit trail.
 */

import prisma from '../lib/prisma';

interface AwardPointsParams {
  userId: string;
  seasonId: string;
  points: number;
  reason: string;  // Required - e.g., "Manual by Jason", "2nd place on Friday #2"
  createdById?: string;  // Admin who made the change (null for system)
}

export const pointsService = {
  /**
   * Award or deduct points from a user for a season
   * Creates history record and updates standing
   */
  async adjustPoints({ userId, seasonId, points, reason, createdById }: AwardPointsParams) {
    // Create history record
    const historyRecord = await prisma.pointsHistory.create({
      data: {
        userId,
        seasonId,
        points,
        reason,
        createdById,
      },
    });

    // Update or create standing
    const existing = await prisma.standing.findUnique({
      where: { seasonId_userId: { seasonId, userId } },
    });

    if (existing) {
      await prisma.standing.update({
        where: { id: existing.id },
        data: {
          totalPoints: Math.max(0, existing.totalPoints + points),
        },
      });
    } else if (points > 0) {
      await prisma.standing.create({
        data: {
          userId,
          seasonId,
          totalPoints: points,
          eventsPlayed: 0,
        },
      });
    }

    return historyRecord;
  },

  /**
   * Get points history for a user (optionally filtered by season)
   */
  async getUserPointsHistory(userId: string, seasonId?: string) {
    return prisma.pointsHistory.findMany({
      where: {
        userId,
        ...(seasonId && { seasonId }),
      },
      include: {
        season: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get all users with their current season points, ordered by last login
   */
  async getUsersForPointsManagement() {
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
    });

    if (!activeSeason) {
      return { season: null, users: [] };
    }

    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        lastLoginAt: true,
        createdAt: true,
        standings: {
          where: { seasonId: activeSeason.id },
          select: { totalPoints: true, rank: true },
        },
      },
      orderBy: [
        { lastLoginAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });

    return {
      season: activeSeason,
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        lastLoginAt: u.lastLoginAt,
        seasonPoints: u.standings[0]?.totalPoints || 0,
        rank: u.standings[0]?.rank || null,
      })),
    };
  },

  /**
   * Get user details for admin view (includes admin notes)
   */
  async getUserAdminDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        standings: {
          include: {
            season: { select: { name: true, isActive: true } },
          },
          orderBy: { season: { startDate: 'desc' } },
        },
        pointsHistory: {
          include: {
            season: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        results: {
          include: {
            event: { select: { name: true, dateTime: true } },
          },
          orderBy: { event: { dateTime: 'desc' } },
          take: 20,
        },
      },
    });

    return user;
  },

  /**
   * Update admin notes for a user
   */
  async updateAdminNotes(userId: string, notes: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { adminNotes: notes },
      select: { id: true, adminNotes: true },
    });
  },

  /**
   * Bulk award points to multiple users
   */
  async bulkAwardPoints(
    userIds: string[],
    seasonId: string,
    points: number,
    reason: string,
    createdById: string
  ) {
    const results = await Promise.all(
      userIds.map(userId =>
        this.adjustPoints({ userId, seasonId, points, reason, createdById })
      )
    );
    return results;
  },
};
