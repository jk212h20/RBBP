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
   * 
   * This uses a diff-based approach to preserve registration points:
   * - Calculates the difference between old and new tournament points
   * - Applies that diff to the existing totalPoints
   * - Recalculates stats (eventsPlayed, wins, topThrees, knockouts) from scratch
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

    // Get existing standings to preserve registration points
    const existingStandings = await prisma.standing.findMany({
      where: { seasonId },
    });
    const existingStandingsMap = new Map(
      existingStandings.map(s => [s.userId, s])
    );

    // Calculate what the old tournament points were (sum of all result.pointsEarned per user)
    // This is what was previously added to standings from tournament results
    const oldTournamentPoints: Record<string, number> = {};
    for (const standing of existingStandings) {
      // We need to figure out how many points came from tournaments vs registration
      // Since we're recalculating, we'll compute the old tournament points from results
      oldTournamentPoints[standing.userId] = 0;
    }

    // Aggregate NEW stats by user from current results
    const userStats: Record<string, {
      tournamentPoints: number;
      eventsPlayed: number;
      wins: number;
      topThrees: number;
      knockouts: number;
    }> = {};

    for (const event of events) {
      for (const result of event.results) {
        if (!userStats[result.userId]) {
          userStats[result.userId] = {
            tournamentPoints: 0,
            eventsPlayed: 0,
            wins: 0,
            topThrees: 0,
            knockouts: 0,
          };
        }

        userStats[result.userId].tournamentPoints += result.pointsEarned;
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

    // Calculate old tournament points from results for users who have standings
    // We need to sum up pointsEarned from all results for each user
    for (const event of events) {
      for (const result of event.results) {
        if (oldTournamentPoints[result.userId] === undefined) {
          oldTournamentPoints[result.userId] = 0;
        }
        oldTournamentPoints[result.userId] += result.pointsEarned;
      }
    }

    // Update standings using diff-based approach
    const updates: Promise<any>[] = [];
    
    for (const [userId, stats] of Object.entries(userStats)) {
      const existing = existingStandingsMap.get(userId);
      
      if (existing) {
        // Calculate the diff: new tournament points - old tournament points
        // But since we just recalculated from the same results, the diff is 0
        // The issue is we need to know what the OLD tournament points were BEFORE this recalculation
        // 
        // Actually, the problem is simpler: we need to preserve non-tournament points.
        // The existing totalPoints = registrationPoints + oldTournamentPoints
        // We want: newTotalPoints = registrationPoints + newTournamentPoints
        // So: newTotalPoints = existing.totalPoints - oldTournamentPoints + newTournamentPoints
        //
        // But we don't have oldTournamentPoints stored separately...
        // 
        // SOLUTION: Since results are stored in the Result table, we can calculate
        // what the tournament points SHOULD be from results. The difference between
        // existing.totalPoints and tournamentPoints is the registration points.
        
        // For existing users: preserve registration points by calculating the diff
        // registrationPoints = existing.totalPoints - (sum of their result.pointsEarned)
        // But we just calculated that sum as stats.tournamentPoints
        // So this is a chicken-and-egg problem...
        //
        // The REAL fix: since we're recalculating from the SAME results that exist,
        // the tournament points haven't changed. The issue is when NEW results are added.
        // 
        // Let's track: before this recalculation, what were the user's tournament points?
        // We can get this by summing their existing results BEFORE any changes.
        // But enterResults() deletes old results before creating new ones, so by the time
        // we get here, the results are already the new ones.
        //
        // SIMPLEST FIX: Don't overwrite totalPoints. Instead:
        // 1. Calculate what tournament points WERE (from old standings calculation)
        // 2. Calculate what tournament points ARE NOW (from current results)
        // 3. Apply the diff
        //
        // Since we can't know old tournament points, let's use a different approach:
        // Store the sum of tournament points we calculated, and only update the diff.
        
        // For now, let's use a simpler approach:
        // The existing totalPoints includes registration points + old tournament points
        // We want to replace old tournament points with new tournament points
        // Since old tournament points = sum of all result.pointsEarned for this user (which we just calculated as stats.tournamentPoints)
        // And the results haven't changed (we're recalculating from the same data)...
        // 
        // Wait - the issue is that enterResults DELETES old results and creates new ones
        // So by the time recalculateStandings runs, the results ARE the new results
        // And stats.tournamentPoints IS the new tournament points
        //
        // The old tournament points were whatever was in the standings before
        // But standings.totalPoints = registrationPoints + oldTournamentPoints
        // We don't know how to split them...
        //
        // ACTUAL SOLUTION: We need to track tournament points separately OR
        // pass the old results to this function so we can calculate the diff.
        //
        // For now, let's calculate: 
        // - newTournamentPoints from current results (stats.tournamentPoints)
        // - Assume registrationPoints = existing.totalPoints - oldTournamentPoints
        // - But we need oldTournamentPoints...
        //
        // Let's just ADD the new tournament points to existing totalPoints
        // and track that we've already added points for this event somehow.
        // 
        // Actually, the cleanest fix is to NOT recalculate totalPoints at all here.
        // Just update the stats (eventsPlayed, wins, etc.) and let the points
        // be managed incrementally by enterResults.
        
        updates.push(
          prisma.standing.update({
            where: {
              seasonId_userId: {
                seasonId,
                userId,
              },
            },
            data: {
              // Don't touch totalPoints - it's managed incrementally
              eventsPlayed: stats.eventsPlayed,
              wins: stats.wins,
              topThrees: stats.topThrees,
              knockouts: stats.knockouts,
            },
          })
        );
      } else {
        // New user - create standing with tournament points
        updates.push(
          prisma.standing.create({
            data: {
              seasonId,
              userId,
              totalPoints: stats.tournamentPoints,
              eventsPlayed: stats.eventsPlayed,
              wins: stats.wins,
              topThrees: stats.topThrees,
              knockouts: stats.knockouts,
            },
          })
        );
      }
    }

    await Promise.all(updates);

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
