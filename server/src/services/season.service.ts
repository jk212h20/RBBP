import prisma from '../lib/prisma';
import { CreateSeasonInput, UpdateSeasonInput, defaultPointsStructure } from '../validators/season.validator';

export class SeasonService {
  /**
   * Get all seasons
   */
  async getAllSeasons() {
    return prisma.season.findMany({
      include: {
        _count: {
          select: {
            events: true,
            standings: true,
          },
        },
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  /**
   * Get season by ID
   */
  async getSeasonById(id: string) {
    return prisma.season.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: {
            dateTime: 'asc',
          },
          include: {
            venue: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                signups: true,
                results: true,
              },
            },
          },
        },
        standings: {
          orderBy: {
            totalPoints: 'desc',
          },
          take: 20,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        _count: {
          select: {
            events: true,
            standings: true,
          },
        },
      },
    });
  }

  /**
   * Get the current active season
   */
  async getCurrentSeason() {
    return prisma.season.findFirst({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            events: true,
            standings: true,
          },
        },
      },
    });
  }

  /**
   * Create a new season
   */
  async createSeason(data: CreateSeasonInput) {
    // If this season is being set as active, deactivate all other seasons
    if (data.isActive) {
      await prisma.season.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
    }

    return prisma.season.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        isActive: data.isActive || false,
        pointsStructure: data.pointsStructure || defaultPointsStructure,
        playoffQualifyCount: data.playoffQualifyCount || 10,
      },
    });
  }

  /**
   * Update a season
   */
  async updateSeason(id: string, data: UpdateSeasonInput) {
    // If this season is being set as active, deactivate all other seasons
    if (data.isActive) {
      await prisma.season.updateMany({
        where: { 
          isActive: true,
          NOT: { id },
        },
        data: { isActive: false },
      });
    }

    return prisma.season.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate && { endDate: new Date(data.endDate) }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.pointsStructure && { pointsStructure: data.pointsStructure }),
        ...(data.playoffQualifyCount && { playoffQualifyCount: data.playoffQualifyCount }),
      },
    });
  }

  /**
   * Activate a season (and deactivate all others)
   */
  async activateSeason(id: string) {
    // Deactivate all seasons
    await prisma.season.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    // Activate the specified season
    return prisma.season.update({
      where: { id },
      data: { isActive: true },
    });
  }

  /**
   * Delete a season (only if no events)
   */
  async deleteSeason(id: string) {
    // Check if season has events
    const eventCount = await prisma.event.count({
      where: { seasonId: id },
    });

    if (eventCount > 0) {
      throw new Error('Cannot delete season with existing events. Remove events first.');
    }

    // Delete standings
    await prisma.standing.deleteMany({
      where: { seasonId: id },
    });

    return prisma.season.delete({
      where: { id },
    });
  }

  /**
   * Get season standings/leaderboard
   */
  async getSeasonStandings(seasonId: string, limit = 50) {
    return prisma.standing.findMany({
      where: { seasonId },
      orderBy: {
        totalPoints: 'desc',
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * Calculate and update all standings for a season
   * Called after results are entered
   */
  async recalculateStandings(seasonId: string) {
    // Get all results for events in this season
    const events = await prisma.event.findMany({
      where: { seasonId },
      include: {
        results: {
          include: {
            user: true,
          },
        },
      },
    });

    // Aggregate stats by user
    const userStats: Record<string, {
      totalPoints: number;
      eventsPlayed: number;
      wins: number;
      topThrees: number;
      knockouts: number;
    }> = {};

    for (const event of events) {
      for (const result of event.results) {
        if (!userStats[result.userId]) {
          userStats[result.userId] = {
            totalPoints: 0,
            eventsPlayed: 0,
            wins: 0,
            topThrees: 0,
            knockouts: 0,
          };
        }

        userStats[result.userId].totalPoints += result.pointsEarned;
        userStats[result.userId].eventsPlayed += 1;
        userStats[result.userId].knockouts += result.knockouts;

        if (result.position === 1) {
          userStats[result.userId].wins += 1;
        }
        if (result.position <= 3) {
          userStats[result.userId].topThrees += 1;
        }
      }
    }

    // Update standings
    const upserts = Object.entries(userStats).map(([userId, stats]) => {
      return prisma.standing.upsert({
        where: {
          seasonId_userId: {
            seasonId,
            userId,
          },
        },
        update: stats,
        create: {
          seasonId,
          userId,
          ...stats,
        },
      });
    });

    await prisma.$transaction(upserts);

    // Update ranks
    const standings = await prisma.standing.findMany({
      where: { seasonId },
      orderBy: { totalPoints: 'desc' },
    });

    const rankUpdates = standings.map((standing, index) => {
      return prisma.standing.update({
        where: { id: standing.id },
        data: { rank: index + 1 },
      });
    });

    await prisma.$transaction(rankUpdates);

    return this.getSeasonStandings(seasonId);
  }
}

export const seasonService = new SeasonService();
