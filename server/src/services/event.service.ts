import prisma from '../lib/prisma';
import { CreateEventInput, UpdateEventInput, ResultEntry, BulkCreateEventsInput } from '../validators/event.validator';
import { EventStatus, SignupStatus } from '@prisma/client';
import { seasonService } from './season.service';
import { pointsService } from './points.service';
import { processReferralReward } from './referral.service';
import { sendEventSignupEmail } from './email.service';
import { createInvoice, lookupInvoice } from './voltage.service';
import { sideBetService } from './side-bet.service';

/**
 * Compute the buy-in price a player owes at this moment.
 * Returns null when the event has no buy-in (free).
 *
 * Pricing rules:
 *   - Free event (buyInSats null or 0) -> null.
 *   - If the player pays AT LEAST `prepayDiscountHours` before event start, they pay
 *     `buyInSats - prepayDiscountSats` (floored at 0).
 *   - Otherwise full price.
 */
export function computeBuyInPrice(event: {
  buyInSats: number | null;
  prepayDiscountSats: number | null;
  prepayDiscountHours: number;
  dateTime: Date;
}, now: Date = new Date()): { priceSats: number; discountApplied: boolean; fullPriceSats: number; discountSats: number } | null {
  const full = event.buyInSats ?? 0;
  if (full <= 0) return null;
  const discount = event.prepayDiscountSats ?? 0;
  const hoursBefore = (event.dateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const qualifies = discount > 0 && hoursBefore >= event.prepayDiscountHours;
  const priceSats = qualifies ? Math.max(0, full - discount) : full;
  return {
    priceSats,
    discountApplied: qualifies,
    fullPriceSats: full,
    discountSats: qualifies ? discount : 0,
  };
}

// ============================================
// ROATAN TIMEZONE HANDLING
// ============================================
// Roatan, Honduras is in Central Standard Time (CST) year-round.
// It does NOT observe daylight saving time. Always UTC-6.
// All event times entered by admins are assumed to be in Roatan time.
const ROATAN_UTC_OFFSET = '-06:00';

/**
 * Convert a datetime string (without timezone) to a Date interpreted as Roatan time (CST, UTC-6).
 * If the string already has timezone info (Z, +, -), it is parsed as-is.
 * Examples:
 *   "2026-02-20T19:00" → interpreted as 2026-02-20T19:00:00-06:00 → stored as 2026-02-21T01:00:00Z
 *   "2026-02-20T19:00:00Z" → kept as-is (already has timezone)
 */
function toRoatanTime(dateTimeStr: string): Date {
  // If the string already contains timezone info, parse as-is
  if (dateTimeStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateTimeStr)) {
    return new Date(dateTimeStr);
  }
  // Otherwise, append Roatan offset so it's interpreted as CST
  return new Date(`${dateTimeStr}:00${ROATAN_UTC_OFFSET}`);
}

/**
 * Build a Roatan-time Date from year/month/day/hours/minutes.
 * Used by bulk event creation where we construct dates manually.
 */
function buildRoatanDate(year: number, month: number, day: number, hours: number, minutes: number): Date {
  // Construct ISO string with Roatan offset
  const pad = (n: number) => n.toString().padStart(2, '0');
  const isoStr = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${ROATAN_UTC_OFFSET}`;
  return new Date(isoStr);
}

// ============================================
// SLUG GENERATION
// ============================================

/**
 * Convert an arbitrary string into a URL-friendly slug.
 * Lowercase, strips non-alphanumerics, collapses runs of hyphens, trims edges.
 */
function slugifyBase(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')       // non-alphanumerics -> hyphen
    .replace(/^-+|-+$/g, '')            // trim hyphens
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');           // trim again after slice
}

/**
 * Generate a unique slug for an event name. Tries the bare slug first,
 * then appends -2, -3, ... until it finds an unused one.
 * If `excludeId` is provided, that event id's existing slug is ignored
 * (used when updating an event in place).
 */
async function generateUniqueEventSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugifyBase(name) || 'event';
  let candidate = base;
  let suffix = 2;
  // Cap iterations defensively
  for (let i = 0; i < 1000; i++) {
    const existing = await prisma.event.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) {
      return candidate;
    }
    candidate = `${base}-${suffix++}`;
  }
  // Fallback: append a random-ish tail (timestamp)
  return `${base}-${Date.now().toString(36)}`;
}

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

async function awardAttendancePointOnce(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { seasonId: true, name: true, leaguePointsEnabled: true },
  });
  if (!event || !event.leaguePointsEnabled) return null;

  // Historical explicit check-ins used "Check-in point". New result finalization
  // awards use "Attendance point". Either one means this event's attendance
  // point has already been awarded.
  const existing = await prisma.pointsHistory.findFirst({
    where: {
      userId,
      seasonId: event.seasonId,
      points: 1,
      OR: [
        { reason: `Check-in point: ${event.name}` },
        { reason: `Attendance point: ${event.name}` },
      ],
    },
  });
  if (existing) return existing;

  return pointsService.adjustPoints({
    userId,
    seasonId: event.seasonId,
    points: 1,
    reason: `Attendance point: ${event.name}`,
  });
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

    const events = await prisma.event.findMany({
      where,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            imageUrl: true,
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

    if (filters?.upcoming) {
      Promise.all(events.map(event => sideBetService.ensureEventSideBet(event.id))).catch((error) => {
        console.error('[SideBet] Failed ensuring side bets for events list:', error);
      });
    }

    return events;
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(limit = 10) {
    // Keep the current event visible for a grace window after it starts so
    // players can still sign up / enter the last-longer at the venue. The
    // event only drops off once completed/cancelled or the window passes.
    const graceHours = parseInt(process.env.EVENT_HOME_GRACE_HOURS || '6', 10);
    const windowStart = new Date(Date.now() - graceHours * 60 * 60 * 1000);

    const events = await prisma.event.findMany({
      where: {
        dateTime: { gte: windowStart },
        status: {
          in: [EventStatus.SCHEDULED, EventStatus.REGISTRATION_OPEN, EventStatus.IN_PROGRESS],
        },
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            address: true,
            // imageUrl intentionally excluded: it can be a large base64 blob and
            // no consumer of the upcoming-events list renders the venue image.
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

    // Best-effort: every event should have its automatic side bet available.
    Promise.all(events.map(event => sideBetService.ensureEventSideBet(event.id))).catch((error) => {
      console.error('[SideBet] Failed ensuring side bets for upcoming events:', error);
    });

    return events;
  }

  /**
   * Get event by ID or slug with full details.
   * Tries id first (for backwards compatibility with old random-id URLs),
   * falls back to slug.
   */
  async getEventById(idOrSlug: string) {
    const event = await prisma.event.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
      include: {
        venue: true,
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
                profile: {
                  select: {
                    profileImage: true,
                  },
                },
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
                profile: {
                  select: {
                    profileImage: true,
                  },
                },
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

    if (event) {
      try {
        await sideBetService.ensureEventSideBet(event.id);
      } catch (error) {
        console.error(`[SideBet] Failed ensuring side bet for event ${event.id}:`, error);
      }
    }

    return event;
  }

  /**
   * Create a new event
   */
  async createEvent(data: CreateEventInput) {
    const slug = await generateUniqueEventSlug(data.name);
    const event = await prisma.event.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        dateTime: toRoatanTime(data.dateTime),
        registrationOpenDays: data.registrationOpenDays ?? 10,
        registrationCloseMinutes: data.registrationCloseMinutes ?? 30,
        maxPlayers: data.maxPlayers || 50,
        buyInSats: data.buyInSats ?? null,
        prepayDiscountSats: data.prepayDiscountSats ?? 0,
        prepayDiscountHours: data.prepayDiscountHours ?? 3,
        venueId: data.venueId,
        seasonId: data.seasonId,
        directorId: data.directorId || null,
        status: data.status || EventStatus.SCHEDULED,
        leaguePointsEnabled: data.leaguePointsEnabled ?? true,
        registrationPointsEnabled: (data.leaguePointsEnabled ?? true) ? (data.registrationPointsEnabled ?? true) : false,
        rulesUrl: data.rulesUrl || null,
        lastLongerEnabled: false,
        lastLongerSeedSats: data.lastLongerSeedSats ?? 10000,
        lastLongerEntrySats: data.lastLongerEntrySats ?? 25000,
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

    try {
      await sideBetService.ensureEventSideBet(event.id);
    } catch (error) {
      console.error(`[SideBet] Failed creating automatic side bet for new event ${event.id}:`, error);
    }

    return event;
  }

  /**
   * Update an event
   */
  async updateEvent(id: string, data: UpdateEventInput) {
    // If the name changed, regenerate the slug so the URL stays in sync.
    let slugUpdate: { slug: string } | {} = {};
    if (data.name) {
      const current = await prisma.event.findUnique({ where: { id }, select: { name: true } });
      if (current && current.name !== data.name) {
        slugUpdate = { slug: await generateUniqueEventSlug(data.name, id) };
      }
    }
    return prisma.event.update({
      where: { id },
      data: {
        ...slugUpdate,
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.dateTime && { dateTime: toRoatanTime(data.dateTime) }),
        ...(data.registrationOpenDays !== undefined && { registrationOpenDays: data.registrationOpenDays }),
        ...(data.registrationCloseMinutes !== undefined && { registrationCloseMinutes: data.registrationCloseMinutes }),
        ...(data.maxPlayers && { maxPlayers: data.maxPlayers }),
        ...(data.buyInSats !== undefined && { buyInSats: data.buyInSats }),
        ...(data.prepayDiscountSats !== undefined && { prepayDiscountSats: data.prepayDiscountSats ?? 0 }),
        ...(data.prepayDiscountHours !== undefined && { prepayDiscountHours: data.prepayDiscountHours }),
        ...(data.venueId && { venueId: data.venueId }),
        ...(data.seasonId && { seasonId: data.seasonId }),
        ...(data.directorId !== undefined && { directorId: data.directorId }),
        ...(data.status && { status: data.status }),
        ...(data.leaguePointsEnabled !== undefined && { leaguePointsEnabled: data.leaguePointsEnabled }),
        ...(data.registrationPointsEnabled !== undefined && { registrationPointsEnabled: data.registrationPointsEnabled }),
        ...(data.leaguePointsEnabled === false && { registrationPointsEnabled: false }),
        ...(data.rulesUrl !== undefined && { rulesUrl: data.rulesUrl || null }),
        ...(data.lastLongerEnabled !== undefined && { lastLongerEnabled: false }),
        ...(data.lastLongerSeedSats !== undefined && { lastLongerSeedSats: data.lastLongerSeedSats }),
        ...(data.lastLongerEntrySats !== undefined && { lastLongerEntrySats: data.lastLongerEntrySats }),
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
  async signupForEvent(eventId: string, userId: string, opts: { payOnArrival?: boolean } = {}) {
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

    if (existingSignup && existingSignup.status !== SignupStatus.CANCELLED) {
      // If this is a paid event and they have a pending unpaid signup, hand them
      // back a fresh invoice instead of erroring out (lets them resume from the QR).
      const buyInInfo = computeBuyInPrice(event);
      if (buyInInfo && !existingSignup.paidAt && !existingSignup.payOnArrival) {
        const memo = `${event.name} buy-in`;
        const { paymentRequest, paymentHash } = await createInvoice(buyInInfo.priceSats, memo);
        await prisma.eventSignup.update({
          where: { id: existingSignup.id },
          data: { paymentHash },
        });
        return {
          ...existingSignup,
          invoice: { paymentRequest, paymentHash, amountSats: buyInInfo.priceSats, discountApplied: buyInInfo.discountApplied, fullPriceSats: buyInInfo.fullPriceSats },
        };
      }
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
    const pointsToAward = event.leaguePointsEnabled && event.registrationPointsEnabled
      ? (isEarlyBird ? EARLY_BIRD_REGISTRATION_POINTS : REGISTRATION_POINTS)
      : 0;

    // Determine buy-in pricing and whether we need to mint a Lightning invoice.
    // A non-zero buyInSats means this is a paid event; players either pay now
    // (we generate a BOLT11 invoice + payment hash) or choose pay-on-arrival.
    const buyInInfo = computeBuyInPrice(event);
    const wantsPayOnArrival = !!opts.payOnArrival;
    let invoice: { paymentRequest: string; paymentHash: string; amountSats: number; discountApplied: boolean; fullPriceSats: number } | null = null;
    let paymentHash: string | null = null;

    if (buyInInfo && !wantsPayOnArrival) {
      const memo = `${event.name} buy-in`;
      const { paymentRequest, paymentHash: ph } = await createInvoice(buyInInfo.priceSats, memo);
      paymentHash = ph;
      invoice = {
        paymentRequest,
        paymentHash: ph,
        amountSats: buyInInfo.priceSats,
        discountApplied: buyInInfo.discountApplied,
        fullPriceSats: buyInInfo.fullPriceSats,
      };
    }

    // If an existing CANCELLED signup row exists, reactivate it instead of
    // creating a duplicate (unique key is eventId+userId).
    const reactivate = existingSignup && existingSignup.status === SignupStatus.CANCELLED
      ? existingSignup
      : null;

    const signup = reactivate
      ? await prisma.eventSignup.update({
          where: { id: reactivate.id },
          data: {
            status: SignupStatus.REGISTERED,
            registeredAt: new Date(),
            checkedInAt: null,
            paymentHash,
            payOnArrival: wantsPayOnArrival,
            paidAt: null,
            paidAmountSats: null,
            paidInPerson: false,
          },
          include: { user: { select: { id: true, name: true } } },
        })
      : await prisma.eventSignup.create({
          data: {
            eventId,
            userId,
            status: SignupStatus.REGISTERED,
            paymentHash,
            payOnArrival: wantsPayOnArrival,
          },
          include: { user: { select: { id: true, name: true } } },
        });

    // Award registration points for the season (skipped when the event
    // has registrationPointsEnabled = false, e.g. one-off finals)
    if (pointsToAward !== 0) {
      await this.adjustUserSeasonPoints(userId, event.seasonId, pointsToAward);
    }

    // Send signup confirmation email (non-blocking)
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
      .then(async (user) => {
        if (user?.email) {
          const eventWithVenue = await prisma.event.findUnique({
            where: { id: eventId },
            include: { venue: { select: { name: true } } },
          });
          if (eventWithVenue) {
            sendEventSignupEmail({
              to: user.email,
              playerName: user.name || 'Player',
              eventName: eventWithVenue.name,
              eventDate: eventWithVenue.dateTime,
              venueName: eventWithVenue.venue.name,
              eventId,
            }).catch(() => {});
          }
        }
      })
      .catch(() => {});

    return invoice ? { ...signup, invoice } : signup;
  }

  /**
   * Check whether the user's buy-in invoice has been paid.
   * Returns { paid: boolean, paidAt?: Date, amountPaidSats?: number }.
   * Updates the signup record on first observed settlement.
   */
  async checkSignupPayment(eventId: string, userId: string) {
    const signup = await prisma.eventSignup.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!signup) throw new Error('Not registered for this event');
    if (signup.paidAt) {
      return { paid: true, paidAt: signup.paidAt, amountPaidSats: signup.paidAmountSats };
    }
    if (!signup.paymentHash) {
      return { paid: false };
    }
    const { settled, amountPaidSats } = await lookupInvoice(signup.paymentHash);
    if (settled) {
      const updated = await prisma.eventSignup.update({
        where: { id: signup.id },
        data: { paidAt: new Date(), paidAmountSats: amountPaidSats },
      });
      return { paid: true, paidAt: updated.paidAt, amountPaidSats: updated.paidAmountSats };
    }
    return { paid: false };
  }

  /**
   * Admin/TD marks a player as paid in person (no Lightning involved).
   * Idempotent: marking twice is a no-op.
   */
  async markSignupPaidInPerson(eventId: string, userId: string) {
    const signup = await prisma.eventSignup.findUnique({
      where: { eventId_userId: { eventId, userId } },
      include: { event: { select: { buyInSats: true } } },
    });
    if (!signup) throw new Error('Signup not found');
    if (signup.paidAt) return signup; // already paid
    return prisma.eventSignup.update({
      where: { id: signup.id },
      data: {
        paidAt: new Date(),
        paidAmountSats: signup.event.buyInSats ?? 0,
        paidInPerson: true,
      },
    });
  }

  /**
   * Admin/TD: list all signups for an event with payment status.
   * Used by the admin registrants panel.
   */
  async getRegistrants(eventId: string) {
    return prisma.eventSignup.findMany({
      where: { eventId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isGuest: true,
            avatar: true,
            profile: { select: { profileImage: true } },
          },
        },
      },
      orderBy: { registeredAt: 'asc' },
    });
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

    // Honor the per-event registration-points flag
    const eventFlag = await prisma.event.findUnique({
      where: { id: eventId },
      select: { leaguePointsEnabled: true, registrationPointsEnabled: true },
    });
    const pointsEnabled = (eventFlag?.leaguePointsEnabled ?? true) && (eventFlag?.registrationPointsEnabled ?? true);

    const isEarlyBird = registeredCount < EARLY_BIRD_THRESHOLD;
    const pointsToAward = pointsEnabled
      ? (isEarlyBird ? EARLY_BIRD_REGISTRATION_POINTS : REGISTRATION_POINTS)
      : 0;

    // Promote to registered
    await prisma.eventSignup.update({
      where: { id: nextInLine.id },
      data: { status: SignupStatus.REGISTERED },
    });

    // Award registration points (skipped if disabled for this event)
    if (pointsToAward !== 0) {
      await this.adjustUserSeasonPoints(nextInLine.userId, seasonId, pointsToAward);
    }
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
        leaguePointsEnabled: true,
        registrationPointsEnabled: true,
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
    // If event hasn't started yet, apply cancellation penalty.
    // Skip entirely if registration points are disabled for this event
    // (no points were awarded at signup, so nothing to claw back).
    if (
      event.leaguePointsEnabled &&
      event.registrationPointsEnabled &&
      event.status !== EventStatus.IN_PROGRESS &&
      event.status !== EventStatus.COMPLETED
    ) {
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
   * Also processes referral rewards if this is a referred user's first check-in.
   */
  async checkInPlayer(eventId: string, userId: string) {
    const result = await prisma.eventSignup.update({
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

    // Award 1 attendance/check-in point for the season, once per event.
    try {
      await awardAttendancePointOnce(eventId, userId);
    } catch (err) {
      console.error(`[CheckIn] Error awarding attendance point for user ${userId}:`, err);
    }

    // Process referral reward (non-blocking, idempotent — only pays once)
    processReferralReward(userId).catch((err) => {
      console.error(`[Referral] Error processing reward for user ${userId}:`, err);
    });

    return result;
  }

  /**
   * Get signups for an event
   */
  async getEventSignups(eventId: string) {
    return prisma.eventSignup.findMany({
      where: { eventId },
      select: {
        id: true,
        eventId: true,
        userId: true,
        status: true,
        registeredAt: true,
        checkedInAt: true,
        // Note: paymentHash / paid* fields are intentionally omitted from the
        // public signup listing. Use the admin-only /registrants endpoint for those.
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
  async enterResults(eventId: string, results: ResultEntry[], options: { finalize?: boolean } = {}) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        season: {
          select: {
            id: true,
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

    // Validate no duplicate positions
    const positions = results.map(r => r.position);
    if (new Set(positions).size !== positions.length) {
      throw new Error('Duplicate positions are not allowed — each player must have a unique place');
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
    // Use totalEntrants override if set, otherwise use checked-in count
    const checkedInCount = event.signups.length;
    const eventRecord = await prisma.event.findUnique({
      where: { id: eventId },
      select: { totalEntrants: true },
    });
    const playerCountForPoints = eventRecord?.totalEntrants ?? checkedInCount;
    const pointsCalc = calculateEventPoints(playerCountForPoints);

    // Calculate points for each result - only top 3 get points
    const resultsWithPoints = results.map((result) => {
      let pointsEarned = 0;

      // If league points are disabled, save placements but force zero points.
      // Otherwise only positions 1, 2, 3 get points by default, but admins may
      // explicitly override pointsEarned when correcting completed results.
      if (!event.leaguePointsEnabled) {
        pointsEarned = 0;
      } else if (result.pointsEarned !== undefined) {
        pointsEarned = result.pointsEarned;
      } else if (result.position === 1) {
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

    // Only finalization changes the event status and processes no-shows.
    // Draft saves and completed-event corrections should not re-run no-show
    // penalties or force a status transition.
    if (options.finalize) {
      // Every player with a submitted result attended the event. Mark matching
      // signups checked-in before no-show processing; otherwise TDs who use the
      // results attendance form without separately clicking each check-in would
      // accidentally leave attendees as REGISTERED and have them no-showed.
      const attendedUserIds = resultsWithPoints.map(result => result.userId);
      if (attendedUserIds.length > 0) {
        await prisma.eventSignup.updateMany({
          where: {
            eventId,
            userId: { in: attendedUserIds },
            status: { in: [SignupStatus.REGISTERED, SignupStatus.CONFIRMED, SignupStatus.WAITLISTED] },
          },
          data: { status: SignupStatus.CHECKED_IN, checkedInAt: new Date() },
        });
      }

      // Award the once-per-event attendance point here too; relying only on
      // the explicit check-in button misses players when TDs enter attendance/
      // results in the results form without separately clicking check-in.
      for (const result of resultsWithPoints) {
        try {
          await awardAttendancePointOnce(eventId, result.userId);
        } catch (error) {
          console.error(`[Attendance] Failed awarding attendance point for event=${eventId} user=${result.userId}:`, error);
        }
      }
    }

    if (options.finalize && event.status !== EventStatus.COMPLETED) {
      await prisma.event.update({
        where: { id: eventId },
        data: { status: EventStatus.COMPLETED },
      });

      // Process no-shows: penalize registered players who didn't attend
      await this.processNoShows(eventId);

      // Settle the automatic event side bet from tournament results.
      try {
        await sideBetService.settleEventSideBet(eventId);
      } catch (error) {
        console.error(`[SideBet] Failed settling event side bet for event ${eventId}:`, error);
      }
    }

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
            profile: {
              select: {
                profileImage: true,
              },
            },
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

      // Apply no-show penalty: remove points earned + 2 penalty (net -2).
      // Skip entirely if registration points are disabled for this event
      // (no points were ever awarded, so a no-show penalty would be punitive
      // for registering at all).
      if (event.leaguePointsEnabled && event.registrationPointsEnabled) {
        const pointsEarned = wasEarlyBird ? EARLY_BIRD_REGISTRATION_POINTS : REGISTRATION_POINTS;
        await this.adjustUserSeasonPoints(signup.userId, event.seasonId, -(pointsEarned + 2));
      }
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
      // Use buildRoatanDate to correctly interpret time as Roatan CST (UTC-6)
      const eventDate = buildRoatanDate(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        currentDate.getDate(),
        hours,
        minutes
      );
      
      const eventNumber = (data.startingNumber || 1) + i;
      const eventName = `${data.baseName} #${eventNumber}`;
      const eventSlug = await generateUniqueEventSlug(eventName);
      
      const event = await prisma.event.create({
        data: {
          name: eventName,
          slug: eventSlug,
          description: data.description || null,
          dateTime: eventDate,
          registrationOpenDays: data.registrationOpenDays ?? 10,
          registrationCloseMinutes: data.registrationCloseMinutes ?? 30,
          maxPlayers: data.maxPlayers || 50,
          buyInSats: data.buyInSats ?? null,
          prepayDiscountSats: data.prepayDiscountSats ?? 0,
          prepayDiscountHours: data.prepayDiscountHours ?? 3,
          venueId: data.venueId,
          seasonId: data.seasonId,
          directorId: data.directorId || null,
          status: data.status || EventStatus.SCHEDULED,
          leaguePointsEnabled: data.leaguePointsEnabled ?? true,
          registrationPointsEnabled: (data.leaguePointsEnabled ?? true) ? (data.registrationPointsEnabled ?? true) : false,
          lastLongerEnabled: false,
          lastLongerSeedSats: data.lastLongerSeedSats ?? 10000,
          lastLongerEntrySats: data.lastLongerEntrySats ?? 25000,
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
