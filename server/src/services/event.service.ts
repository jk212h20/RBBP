import prisma from '../lib/prisma';
import { CreateEventInput, UpdateEventInput, ResultEntry } from '../validators/event.validator';
import { EventStatus, SignupStatus } from '@prisma/client';
import { seasonService } from './season.service';

// Points for registration/unregistration
const REGISTRATION_POINTS = 1;
const UNREGISTER_EARLY_PENALTY = -1;  // 24+ hours before event
const UNREGISTER_LATE_PENALTY = -2;   // Less than 24 hours before event
const NO_SHOW_PENALTY = -3;           // Registered but didn't show up

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
   * Awards +1 registration point for the season
   */
  async signupForEvent(eventId: string, userId: string) {
    // Check if event exists and is open for registration
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        _count: {
          select: { signups: true },
        },
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

    if (event._count.signups >= event.maxPlayers) {
      throw new Error('Event is full');
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

    // Award registration point for the season
    await this.adjustUserSeasonPoints(userId, event.seasonId, REGISTRATION_POINTS);

    return signup;
  }

  /**
   * Cancel signup for an event
   * Applies point penalties based on timing:
   * - 24+ hours before: -1 point (removes registration bonus)
   * - Less than 24 hours: -2 points (penalty for late cancellation)
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

    // Get event to check timing and season
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
      if (hoursUntilEvent >= 24) {
        // Early cancellation: just remove the registration point
        await this.adjustUserSeasonPoints(userId, event.seasonId, UNREGISTER_EARLY_PENALTY);
      } else {
        // Late cancellation: additional penalty
        await this.adjustUserSeasonPoints(userId, event.seasonId, UNREGISTER_LATE_PENALTY);
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
   * Enter results for an event
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
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    const pointsStructure = event.season.pointsStructure as Record<string, number>;

    // Calculate points for each result
    const resultsWithPoints = results.map((result) => {
      let pointsEarned = 0;

      // Check exact position first
      if (pointsStructure[result.position.toString()]) {
        pointsEarned = pointsStructure[result.position.toString()];
      } else {
        // Check ranges like "11-15", "16-20", etc.
        for (const [key, points] of Object.entries(pointsStructure)) {
          if (key.includes('-')) {
            const [min, max] = key.split('-').map(Number);
            if (result.position >= min && result.position <= max) {
              pointsEarned = points;
              break;
            }
          } else if (key.includes('+')) {
            const min = parseInt(key);
            if (result.position >= min) {
              pointsEarned = points;
              break;
            }
          }
        }
      }

      // Add knockout bonus
      if (result.knockouts && pointsStructure.knockout) {
        pointsEarned += result.knockouts * pointsStructure.knockout;
      }

      // Add participation points
      if (pointsStructure.participation) {
        pointsEarned += pointsStructure.participation;
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

    // Update event status
    await prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.COMPLETED },
    });

    // Recalculate season standings
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
        },
      },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    // Get all signups that weren't checked in
    const noShows = event.signups;

    // Apply no-show penalty to each
    for (const signup of noShows) {
      // Update signup status to NO_SHOW
      await prisma.eventSignup.update({
        where: { id: signup.id },
        data: { status: SignupStatus.NO_SHOW },
      });

      // Apply no-show penalty (removes registration point + additional penalty)
      await this.adjustUserSeasonPoints(signup.userId, event.seasonId, NO_SHOW_PENALTY);
    }

    return { noShowCount: noShows.length };
  }
}

export const eventService = new EventService();
