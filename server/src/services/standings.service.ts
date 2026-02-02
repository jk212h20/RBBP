import prisma from '../lib/prisma';

export const standingsService = {
  // Get current season standings
  async getCurrentStandings() {
    // Find the current active season
    const currentSeason = await prisma.season.findFirst({
      where: {
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      orderBy: { startDate: 'desc' }
    });

    if (!currentSeason) {
      // If no active season, get the most recent one
      const recentSeason = await prisma.season.findFirst({
        orderBy: { endDate: 'desc' }
      });
      
      if (!recentSeason) {
        return { season: null, standings: [] };
      }
      
      return this.getSeasonStandings(recentSeason.id);
    }

    return this.getSeasonStandings(currentSeason.id);
  },

  // Get standings for a specific season
  async getSeasonStandings(seasonId: string) {
    const season = await prisma.season.findUnique({
      where: { id: seasonId }
    });

    if (!season) {
      return { season: null, standings: [] };
    }

    // Get standings from the Standing table (denormalized for performance)
    const standings = await prisma.standing.findMany({
      where: { seasonId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      },
      orderBy: { totalPoints: 'desc' }
    });

    // Format standings with rank
    const formattedStandings = standings.map((standing, index) => ({
      rank: index + 1,
      id: standing.userId,
      displayName: standing.user.name || standing.user.email?.split('@')[0] || 'Unknown',
      avatar: standing.user.avatar,
      totalPoints: standing.totalPoints,
      eventsPlayed: standing.eventsPlayed,
      wins: standing.wins,
      topThrees: standing.topThrees,
      knockouts: standing.knockouts
    }));

    return { season, standings: formattedStandings };
  },

  // Get player's standings history
  async getPlayerStandings(playerId: string) {
    const results = await prisma.result.findMany({
      where: { userId: playerId },
      include: {
        event: {
          include: {
            season: true,
            venue: true
          }
        }
      },
      orderBy: {
        event: { dateTime: 'desc' }
      }
    });

    const totalPoints = results.reduce((sum: number, r) => sum + r.pointsEarned, 0);
    const totalKnockouts = results.reduce((sum: number, r) => sum + r.knockouts, 0);

    return {
      playerId,
      totalPoints,
      totalKnockouts,
      eventsPlayed: results.length,
      bestFinish: results.length > 0 ? Math.min(...results.map(r => r.position)) : null,
      recentResults: results.slice(0, 10)
    };
  },

  // Get user's standing for the current active season
  async getUserCurrentSeasonStanding(userId: string) {
    // Find the active season
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true }
    });

    if (!activeSeason) {
      return { season: null, standing: null };
    }

    // Get user's standing for this season
    const standing = await prisma.standing.findUnique({
      where: {
        seasonId_userId: {
          seasonId: activeSeason.id,
          userId
        }
      }
    });

    return {
      season: {
        id: activeSeason.id,
        name: activeSeason.name,
        startDate: activeSeason.startDate,
        endDate: activeSeason.endDate
      },
      standing: standing ? {
        totalPoints: standing.totalPoints,
        eventsPlayed: standing.eventsPlayed,
        wins: standing.wins,
        topThrees: standing.topThrees,
        knockouts: standing.knockouts,
        rank: standing.rank
      } : {
        totalPoints: 0,
        eventsPlayed: 0,
        wins: 0,
        topThrees: 0,
        knockouts: 0,
        rank: null
      }
    };
  },

  // Get user's standings across all seasons (for admin/history view)
  async getUserAllSeasonsStandings(userId: string) {
    const standings = await prisma.standing.findMany({
      where: { userId },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            isActive: true
          }
        }
      },
      orderBy: {
        season: { startDate: 'desc' }
      }
    });

    return standings.map(s => ({
      seasonId: s.seasonId,
      seasonName: s.season.name,
      seasonStartDate: s.season.startDate,
      seasonEndDate: s.season.endDate,
      isActiveSeason: s.season.isActive,
      totalPoints: s.totalPoints,
      eventsPlayed: s.eventsPlayed,
      wins: s.wins,
      topThrees: s.topThrees,
      knockouts: s.knockouts,
      rank: s.rank
    }));
  },

  // Recalculate standings for a season (called after event results are entered)
  async recalculateSeasonStandings(seasonId: string) {
    // Get all results for events in this season
    const results = await prisma.result.findMany({
      where: {
        event: { seasonId }
      },
      include: {
        user: true
      }
    });

    // Aggregate by player
    const playerStats = new Map<string, {
      totalPoints: number;
      eventsPlayed: number;
      wins: number;
      topThrees: number;
      knockouts: number;
    }>();

    for (const result of results) {
      const existing = playerStats.get(result.userId);
      const isWin = result.position === 1;
      const isTopThree = result.position <= 3;

      if (existing) {
        existing.totalPoints += result.pointsEarned;
        existing.eventsPlayed += 1;
        existing.wins += isWin ? 1 : 0;
        existing.topThrees += isTopThree ? 1 : 0;
        existing.knockouts += result.knockouts;
      } else {
        playerStats.set(result.userId, {
          totalPoints: result.pointsEarned,
          eventsPlayed: 1,
          wins: isWin ? 1 : 0,
          topThrees: isTopThree ? 1 : 0,
          knockouts: result.knockouts
        });
      }
    }

    // Upsert standings for each player
    for (const [userId, stats] of playerStats) {
      await prisma.standing.upsert({
        where: {
          seasonId_userId: { seasonId, userId }
        },
        update: {
          totalPoints: stats.totalPoints,
          eventsPlayed: stats.eventsPlayed,
          wins: stats.wins,
          topThrees: stats.topThrees,
          knockouts: stats.knockouts
        },
        create: {
          seasonId,
          userId,
          totalPoints: stats.totalPoints,
          eventsPlayed: stats.eventsPlayed,
          wins: stats.wins,
          topThrees: stats.topThrees,
          knockouts: stats.knockouts
        }
      });
    }

    // Update ranks
    const allStandings = await prisma.standing.findMany({
      where: { seasonId },
      orderBy: { totalPoints: 'desc' }
    });

    for (let i = 0; i < allStandings.length; i++) {
      await prisma.standing.update({
        where: { id: allStandings[i].id },
        data: { rank: i + 1 }
      });
    }

    return { updated: playerStats.size };
  }
};
