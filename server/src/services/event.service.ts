import prisma from '../lib/prisma';
import { CreateEventInput, UpdateEventInput, ResultEntry, BulkCreateEventsInput } from '../validators/event.validator';
import { EventStatus, SignupStatus } from '@prisma/client';
import { seasonService } from './season.service';
import { pointsService } from './points.service';

// Points for registration/unregistration
const REGISTRATION_POINTS = 1;
const EARLY_BIRD_REGISTRATION_POINTS = 2;  // First 5 signups get bonus
const EARLY_BIRD_THRESHOLD = 5;            // Number of early bird spots
const UNREGISTER_EARLY_PENALTY = -1;  // 24+ hours before event (per point earned)
const UNREGISTER_LATE_PENALTY = -2;   // Less than 24 hours before event (per point earned)
const NO_SHOW_PENALTY = -3;           // Registered but didn't show up (per point earned)

// ============================================
// DYNAMIC POINTS CALCULATION
// ============================================

/**
 * Calculate event points based on checked-in player count
 * - Base pool: 10 points for 10 or fewer players
 * - +2 points per player beyond 10
 * - Distribution: 60% / 30% / 10% (rounded up)
 * - Only top 3 get points
 */
export function calculateEventPoints(checkedInCount: number) {
  // Base: 10 points for first 10 players
  // +2 points for each player beyond 10
  const extraPlayers = Math.max(0, checkedInCount - 10);
  const totalPool = 10 + (extraPlayers * 2);
  
  return {
    first: Math.ceil(totalPool * 0.60),   // 60% rounded up
    second: Math.ceil(totalPool * 0.30),  // 30% rounded up  
    third: Math.ceil(totalPool * 0.10),   // 10% rounded up
    totalPool,
    playerCount: checkedInCount
  };
}

export class EventService {
  /**
   * Get all events with optional filters
   */
  async getAllEvents(filters?: {
    seasonId?: string;
    venueId?: string;
    status?: EventStatus;
    upcoming?: boolean;
  }) {
    const where: any = {};

    if (filters?.seasonId) {
      where.seasonId = filters.seasonId;
    }
    if (filters?.venueId) {
      where.venueId = filters.venueId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.upcoming) {
      where.dateTime = { gte: new Date() };
    }

    return prisma.event.findMany({
      where,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        season: {
          select: {
            id: true,
            name: true,
          },
        },
        director: {
          select: {
            id: true,
            name: true,
          },
        },
        signups: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            signups: true,
            results: true,
          },
        },
      },
      orderBy: {
        dateTime: 'asc',
      },
    });
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit = 10) {
    return prisma.event.findMany({
      where: {
        dateTime: { gte: new Date() },
        status: {
          in: [EventStatus.SCHEDULED, EventStatus.REGISTRATION_OPEN],
        },
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        season: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            signups: true,
          },
        },
      },
      orderBy: {
        dateTime: 'asc',
      },
      take: limit,
    });
  }

  /**
   * Get event by ID with full details
   */
  async getEventById(id: string) {
    return prisma.event.findUnique({
      where: { id },
      include: {
        venue: true,
        season: {
          select: {
            id: true,
            name: true,
            pointsStructure: true,
          },
        },
        director: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        signups: {
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
            registeredAt: 'asc',
          },
        },
        results: {
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
            position: 'asc',
          },
        },
        _count: {
          select: {
            signups: true,
            results: true,
            comments: true,
          },
        },
      },
    });
  }

  /**
   * Create a new event
   */
  async createEvent(data: CreateEventInput) {
    return prisma.event.create({
      data: {
        name: data.name,
        description: data.description || null,
        dateTime: new Date(data.dateTime),
        registrationOpenDays: data.registrationOpenDays ?? 10,
        maxPlayers: data.maxPlayers || 50,
        buyIn: data.buyIn || null,
        venueId: data.venueId,
        seasonId: data.seasonId,
        directorId: data.directorId || null,
        status: data.status || EventStatus.SCHEDULED,
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        season: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Update an event
   */
  async updateEvent(id: string, data: UpdateEventInput) {
    return prisma.event.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.dateTime && { dateTime: new Date(data.dateTime) }),
        ...(data.registrationOpenDays !== undefined && { registrationOpenDays: data.registrationOpenDays }),
        ...(data.maxPlayers && { maxPlayers: data.maxPlayers }),
        ...(data.buyIn !== undefined && { buyIn: data.buyIn }),
        ...(data.venueId && { venueId: data.venueId }),
        ...(data.seasonId && { seasonId: data.seasonId }),
        ...(data.directorId !== undefined && { directorId: data.directorId }),
        ...(data.status && { status: data.status }),
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        season: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Delete an event
   */
  async deleteEvent(id: string) {
    // Delete related records first
    await prisma.eventSignup.deleteMany({ where: { eventId: id } });
    await prisma.result.deleteMany({ where: { eventId: id } });
    await prisma.comment.deleteMany({ where: { eventId: id } });
    
    return prisma.event.delete({ where: { id } });
  }

  /**
   * Update event status
   */
  async updateEventStatus(id: string, status: EventStatus) {
    return prisma.event.update({
      where: { id },
      data: { status },
    });
  }

  // ============================================
  // SIGNUP MANAGEMENT
  // ============================================

  /**
   * Sign up for an event
   * Awards registration points for the season:
   * - First 5 signups get 2 points (early bird bonus)
   * - Remaining signups get 1 point
   * - If event is full, user is added to waitlist (no points awarded)
   */
  async signupForEvent(eventId: string, userId: string) {
    // Check if event exists and is open for registration
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        season: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    if (event.status !== EventStatus.SCHEDULED && event.status !== EventStatus.REGISTRATION_OPEN) {
      throw new Error('Event is not open for registration');
    }

    // Check if user is already signed up
    const existingSignup = await prisma.eventSignup.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (existingSignup) {
      throw new Error('Already signed up for this event');
    }

    // Count current registered (non-waitlisted) signups
    const registeredCount = await prisma.eventSignup.count({
      where: {
        eventId,
        status: {
          notIn: [SignupStatus.WAITLISTED, SignupStatus.CANCELLED],
        },
      },
    });

    // Determine if user goes on waitlist or gets registered
    const isWaitlisted = registeredCount >= event.maxPlayers;

    if (isWaitlisted) {
      // Add to waitlist - no points awarded
      const signup = await prisma.eventSignup.create({
        data: {
          eventId,
          userId,
          status: SignupStatus.WAITLISTED,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Get waitlist position
      const waitlistPosition = await this.getWaitlistPosition(eventId, userId);

      return { ...signup, waitlistPosition };
    }

    // Determine if this is an early bird signup (first 5 get bonus)
    const isEarlyBird = registeredCount < EARLY_BIRD_THRESHOLD;
    const pointsToAward = isEarlyBird ? EARLY_BIRD_REGISTRATION_POINTS : REGISTRATION_POINTS;

    // Create signup
    const signup = await prisma.eventSignup.create({
      data: {
        eventId,
        userId,
        status: SignupStatus.REGISTERED,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Award registration points for the season
    await this.adjustUserSeasonPoints(userId, event.seasonId, pointsToAward);

    return signup;
  }

  /**
   * Get a user's position on the waitlist for an event
   */
  async getWaitlistPosition(eventId: string, userId: string): Promise<number | null> {
    const signup = await prisma.eventSignup.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!signup || signup.status !== SignupStatus.WAITLISTED) {
      return null;
    }

    // Count how many waitlisted signups were registered before this one
    const position = await prisma.eventSignup.count({
      where: {
        eventId,
        status: SignupStatus.WAITLISTED,
        registeredAt: { lt: signup.registeredAt },
      },
    });

    return position + 1; // 1-indexed position
  }

  /**
   * Promote the next person from waitlist when a spot opens
   */
  async promoteFromWaitlist(eventId: string, seasonId: string): Promise<void> {
    // Find the oldest waitlisted signup
    const nextInLine = await prisma.eventSignup.findFirst({
      where: {
        eventId,
        status: SignupStatus.WAITLISTED,
      },
      orderBy: {
        registeredAt: 'asc',
      },
    });

    if (!nextInLine) {
      return; // No one on waitlist
    }

    // Count current registered signups to determine early bird status
    const registeredCount = await prisma.eventSignup.count({
      where: {
        eventId,
        status: {
          notIn: [SignupStatus.WAITLISTED, SignupStatus.CANCELLED],
        },
      },
    });

    const isEarlyBird = registeredCount < EARLY_BIRD_THRESHOLD;
    const pointsToAward = isEarlyBird ? EARLY_BIRD_REGISTRATION_POINTS : REGISTRATION_POINTS;

    // Promote to registered
    await prisma.eventSignup.update({
      where: { id: nextInLine.id },
      data: { status: SignupStatus.REGISTERED },
    });

    // Award registration points
    await this.adjustUserSeasonPoints(nextInLine.userId, seasonId, pointsToAward);
  }

  /**
   * Cancel signup for an event
   * Applies point penalties based on timing:
   * - Early cancel (24+ hrs): Remove points earned (early bird: -2, regular: -1) → net 0
   * - Late cancel (<24 hrs): Remove points + 1 penalty (early bird: -3, regular: -2) → net -1
   */
  async cancelSignup(eventId: string, userId: string) {
    const signup = await prisma.eventSignup.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    if (!signup) {
      throw new Error('Not signed up for this event');
    }

    // Get event to check timing and season, and count signups before this user
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        dateTime: true,
        seasonId: true,
        status: true,
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Check if this user was an early bird (one of first 5 signups)
    const signupsBeforeUser = await prisma.eventSignup.count({
      where: {
        eventId,
        registeredAt: { lt: signup.registeredAt },
      },
    });
    const wasEarlyBird = signupsBeforeUser < EARLY_BIRD_THRESHOLD;

    // Calculate hours until event
    const now = new Date();
    const eventTime = new Date(event.dateTime);
    const hoursUntilEvent = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Delete the signup
    await prisma.eventSignup.delete({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    // Apply point penalty based on timing
    // If event hasn't started yet, apply cancellation penalty
    if (event.status !== EventStatus.IN_PROGRESS && event.status !== EventStatus.COMPLETED) {
      // Points earned at registration
      const pointsEarned = wasEarlyBird ? EARLY_BIRD_REGISTRATION_POINTS : REGISTRATION_POINTS;
      
      if (hoursUntilEvent >= 24) {
        // Early cancellation: just remove the registration points (net 0)
        await this.adjustUserSeasonPoints(userId, event.seasonId, -pointsEarned);
      } else {
        // Late cancellation: remove points + 1 penalty (net -1)
        await this.adjustUserSeasonPoints(userId, event.seasonId, -(pointsEarned + 1));
      }
    }

    return { message: 'Signup cancelled' };
  }

  /**
   * Check in a player
   */
  async checkInPlayer(eventId: string, userId: string) {
    return prisma.eventSignup.update({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
      data: {
        status: SignupStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
    });
  }

  /**
   * Get signups for an event
   */
  async getEventSignups(eventId: string) {
    return prisma.eventSignup.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            email: true,
          },
        },
      },
      orderBy: {
        registeredAt: 'asc',
      },
    });
  }

  // ============================================
  // RESULTS MANAGEMENT
  // ============================================

  /**
   * Enter results for an event using dynamic points calculation
   * - Points based on checked-in player count
   * - Only top 3 get points (60% / 30% / 10% rounded up)
   * - Uses diff-based point adjustment to preserve registration points
   * - Creates points history records with reasons
   */
  async enterResults(eventId: string, results: ResultEntry[]) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        season: {
          select: {
            id: true,
            pointsStructure: true,
          },
        },
        signups: {
          where: {
            status: SignupStatus.CHECKED_IN,
          },
        },
        results: true, // Get existing results to calculate diff
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Get event name for reason strings
    const eventDetails = await prisma.event.findUnique({
      where: { id: eventId },
      select: { name: true },
    });
    const eventName = eventDetails?.name || 'Event';

    // Get OLD points earned by each user from existing results (before we delete them)
    const oldPointsByUser: Record<string, number> = {};
    const oldPositionByUser: Record<string, number> = {};
    for (const result of event.results) {
      oldPointsByUser[result.userId] = result.pointsEarned;
      oldPositionByUser[result.userId] = result.position;
    }

    // Count checked-in players for dynamic points calculation
    const checkedInCount = event.signups.length;
    const pointsCalc = calculateEventPoints(checkedInCount);

    // Calculate points for each result - only top 3 get points
    const resultsWithPoints = results.map((result) => {
      let pointsEarned = 0;

      // Only positions 1, 2, 3 get points
      if (result.position === 1) {
        pointsEarned = pointsCalc.first;
      } else if (result.position === 2) {
        pointsEarned = pointsCalc.second;
      } else if (result.position === 3) {
        pointsEarned = pointsCalc.third;
      }

      return {
        eventId,
        userId: result.userId,
        position: result.position,
        knockouts: result.knockouts || 0,
        pointsEarned,
      };
    });

    // Delete existing results for this event
    await prisma.result.deleteMany({ where: { eventId } });

    // Create new results
    await prisma.result.createMany({
      data: resultsWithPoints,
    });

    // Apply point diffs to standings with reasons
    // For each user in the new results, calculate: newPoints - oldPoints
    // and adjust their standing accordingly
    for (const result of resultsWithPoints) {
      const oldPoints = oldPointsByUser[result.userId] || 0;
      const newPoints = result.pointsEarned;
      const diff = newPoints - oldPoints;
      
      if (diff !== 0) {
        // Generate reason based on position
        const positionLabel = result.position === 1 ? '1st place' : 
                             result.position === 2 ? '2nd place' : 
                             result.position === 3 ? '3rd place' : `${result.position}th place`;
        const reason = `${positionLabel} finish at ${eventName}`;
        
        await pointsService.adjustPoints({
          userId: result.userId,
          seasonId: event.seasonId,
          points: diff,
          reason,
        });
      }
    }

    // Also handle users who were in old results but not in new results
    // (their points should be removed)
    const newUserIds = new Set(resultsWithPoints.map(r => r.userId));
    for (const [userId, oldPoints] of Object.entries(oldPointsByUser)) {
      if (!newUserIds.has(userId) && oldPoints > 0) {
        // User was removed from results, subtract their old points
        const oldPosition = oldPositionByUser[userId];
        const positionLabel = oldPosition === 1 ? '1st place' : 
                             oldPosition === 2 ? '2nd place' : 
                             oldPosition === 3 ? '3rd place' : `${oldPosition}th place`;
        const reason = `Removed from ${positionLabel} at ${eventName} (results corrected)`;
        
        await pointsService.adjustPoints({
          userId,
          seasonId: event.seasonId,
          points: -oldPoints,
          reason,
        });
      }
    }

    // Update event status
    await prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.COMPLETED },
    });

    // Process no-shows: penalize registered players who didn't attend
    await this.processNoShows(eventId);

    // Recalculate season standings (for stats like eventsPlayed, wins, etc.)
    await seasonService.recalculateStandings(event.seasonId);

    return prisma.result.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        position: 'asc',
      },
    });
  }

  /**
   * Get points preview for an event based on current checked-in count
   */
  async getPointsPreview(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { totalEntrants: true },
    });

    // Use totalEntrants override if set, otherwise count checked-in players
    let playerCount: number;
    if (event?.totalEntrants) {
      playerCount = event.totalEntrants;
    } else {
      playerCount = await prisma.eventSignup.count({
        where: {
          eventId,
          status: SignupStatus.CHECKED_IN,
        },
      });
    }

    return calculateEventPoints(playerCount);
  }

  /**
   * Set total entrants override for an event (TD/Admin only)
   */
  async setTotalEntrants(eventId: string, totalEntrants: number | null) {
    return prisma.event.update({
      where: { id: eventId },
      data: { totalEntrants },
      select: { id: true, totalEntrants: true },
    });
  }

  /**
   * Get results for an event
   */
  async getEventResults(eventId: string) {
    return prisma.result.findMany({
      where: { eventId },
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
        position: 'asc',
      },
    });
  }

  /**
   * Check if user is signed up for event
   */
  async isUserSignedUp(eventId: string, userId: string): Promise<boolean> {
    const signup = await prisma.eventSignup.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });
    return !!signup;
  }

  /**
   * Get events for a user
   */
  async getUserEvents(userId: string) {
    return prisma.event.findMany({
      where: {
        signups: {
          some: {
            userId,
          },
        },
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
        signups: {
          where: {
            userId,
          },
        },
        results: {
          where: {
            userId,
          },
        },
      },
      orderBy: {
        dateTime: 'desc',
      },
    });
  }

  // ============================================
  // POINTS MANAGEMENT
  // ============================================

  /**
   * Adjust a user's season points (for registration bonuses/penalties)
   * This updates the Standing record for the user in the given season
   */
  async adjustUserSeasonPoints(userId: string, seasonId: string, pointsChange: number) {
    // Upsert the standing record
    const existing = await prisma.standing.findUnique({
      where: {
        seasonId_userId: {
          seasonId,
          userId,
        },
      },
    });

    if (existing) {
      // Update existing standing
      await prisma.standing.update({
        where: {
          seasonId_userId: {
            seasonId,
            userId,
          },
        },
        data: {
          totalPoints: Math.max(0, existing.totalPoints + pointsChange), // Don't go below 0
        },
      });
    } else {
      // Create new standing with the points (only if positive)
      if (pointsChange > 0) {
        await prisma.standing.create({
          data: {
            seasonId,
            userId,
            totalPoints: pointsChange,
            eventsPlayed: 0,
            wins: 0,
            topThrees: 0,
            knockouts: 0,
          },
        });
      }
    }
  }

  /**
   * Mark no-shows for an event and apply penalties
   * Called when event is completed - anyone registered but not checked in is a no-show
   * No-show penalty: Remove points earned + 2 penalty (early bird: -4, regular: -3) → net -2
   */
  async processNoShows(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        signups: {
          where: {
            status: {
              in: [SignupStatus.REGISTERED, SignupStatus.CONFIRMED],
            },
          },
          orderBy: {
            registeredAt: 'asc',
          },
        },
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Get all signups that weren't checked in
    const noShows = event.signups;

    // Apply no-show penalty to each
    for (let i = 0; i < noShows.length; i++) {
      const signup = noShows[i];
      
      // Check if this user was an early bird (one of first 5 signups)
      const signupsBeforeUser = await prisma.eventSignup.count({
        where: {
          eventId,
          registeredAt: { lt: signup.registeredAt },
        },
      });
      const wasEarlyBird = signupsBeforeUser < EARLY_BIRD_THRESHOLD;
      
      // Update signup status to NO_SHOW
      await prisma.eventSignup.update({
        where: { id: signup.id },
        data: { status: SignupStatus.NO_SHOW },
      });

      // Apply no-show penalty: remove points earned + 2 penalty (net -2)
      const pointsEarned = wasEarlyBird ? EARLY_BIRD_REGISTRATION_POINTS : REGISTRATION_POINTS;
      await this.adjustUserSeasonPoints(signup.userId, event.seasonId, -(pointsEarned + 2));
    }

    return { noShowCount: noShows.length };
  }

  // ============================================
  // BULK EVENT CREATION
  // ============================================

  /**
   * Create multiple recurring events at once
   * Creates events on a specific day of the week for a number of weeks
   * Names events with # suffix (e.g., "Friday Night Poker #1", "Friday Night Poker #2")
   */
  async createBulkEvents(data: BulkCreateEventsInput) {
    const events = [];
    const startDate = new Date(data.startDate);
    const [hours, minutes] = data.time.split(':').map(Number);
    
    // Find the first occurrence of the target day of week
    let currentDate = new Date(startDate);
    const targetDayOfWeek = data.dayOfWeek;
    
    // Adjust to the first occurrence of the target day
    while (currentDate.getDay() !== targetDayOfWeek) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Create events for each week
    for (let i = 0; i < data.numberOfWeeks; i++) {
      const eventDate = new Date(currentDate);
      eventDate.setHours(hours, minutes, 0, 0);
      
      const eventNumber = (data.startingNumber || 1) + i;
      const eventName = `${data.baseName} #${eventNumber}`;
      
      const event = await prisma.event.create({
        data: {
          name: eventName,
          description: data.description || null,
          dateTime: eventDate,
          registrationOpenDays: data.registrationOpenDays ?? 10,
          maxPlayers: data.maxPlayers || 50,
          buyIn: data.buyIn || null,
          venueId: data.venueId,
          seasonId: data.seasonId,
          directorId: data.directorId || null,
          status: data.status || EventStatus.SCHEDULED,
        },
        include: {
          venue: {
            select: {
              id: true,
              name: true,
            },
          },
          season: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
      
      events.push(event);
      
      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }
    
    return events;
  }
}

export const eventService = new EventService();
