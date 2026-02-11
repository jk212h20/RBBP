import { Router, Request, Response } from 'express';
import { eventService } from '../services/event.service';
import { createEventSchema, updateEventSchema, bulkResultsSchema, bulkCreateEventsSchema } from '../validators/event.validator';
import { authenticate, requireAdmin, requireTournamentDirector } from '../middleware/auth.middleware';
import { EventStatus } from '@prisma/client';
import prisma from '../lib/prisma';

const router = Router();

/**
 * GET /api/events/upcoming
 * Get upcoming events (public)
 * NOTE: Must be before /:id
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const events = await eventService.getUpcomingEvents(limit);
    res.json(events);
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming events' });
  }
});

/**
 * GET /api/events/my
 * Get events for current user
 * NOTE: Must be before /:id
 */
router.get('/my', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const events = await eventService.getUserEvents(req.user.userId);
    res.json(events);
  } catch (error) {
    console.error('Error fetching user events:', error);
    res.status(500).json({ error: 'Failed to fetch your events' });
  }
});

// ============================================
// BULK EVENT CREATION
// ============================================

/**
 * POST /api/events/bulk
 * Create multiple recurring events at once (Admin only)
 * Creates events on a specific day of week for multiple weeks
 * Names events with # suffix (e.g., "Friday Night Poker #1", "Friday Night Poker #2")
 */
router.post('/bulk', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const validation = bulkCreateEventsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const events = await eventService.createBulkEvents(validation.data);
    res.status(201).json({ 
      message: `Successfully created ${events.length} events`,
      events 
    });
  } catch (error) {
    console.error('Error creating bulk events:', error);
    res.status(500).json({ error: 'Failed to create bulk events' });
  }
});

/**
 * GET /api/events
 * Get all events with optional filters (public)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      seasonId: req.query.seasonId as string | undefined,
      venueId: req.query.venueId as string | undefined,
      status: req.query.status as EventStatus | undefined,
      upcoming: req.query.upcoming === 'true',
    };
    
    const events = await eventService.getAllEvents(filters);
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

/**
 * GET /api/events/:id
 * Get event by ID with full details (public)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await eventService.getEventById(req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json(event);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

/**
 * POST /api/events
 * Create a new event (Admin/Tournament Director)
 */
router.post('/', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const validation = createEventSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const event = await eventService.createEvent(validation.data);
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

/**
 * PUT /api/events/:id
 * Update an event (Admin/Tournament Director)
 */
router.put('/:id', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    
    const existingEvent = await eventService.getEventById(eventId);
    if (!existingEvent) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const validation = updateEventSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const event = await eventService.updateEvent(eventId, validation.data);
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

/**
 * PUT /api/events/:id/status
 * Update event status (Admin/Tournament Director)
 */
router.put('/:id/status', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    
    if (!Object.values(EventStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const event = await eventService.updateEventStatus(req.params.id, status);
    res.json(event);
  } catch (error) {
    console.error('Error updating event status:', error);
    res.status(500).json({ error: 'Failed to update event status' });
  }
});

/**
 * DELETE /api/events/:id
 * Delete an event (Admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    await eventService.deleteEvent(req.params.id);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ============================================
// SIGNUP ENDPOINTS
// ============================================

/**
 * POST /api/events/:id/signup
 * Sign up for an event (authenticated users)
 */
router.post('/:id/signup', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const signup = await eventService.signupForEvent(req.params.id, req.user.userId);
    res.status(201).json(signup);
  } catch (error: any) {
    console.error('Error signing up for event:', error);
    res.status(400).json({ error: error.message || 'Failed to sign up for event' });
  }
});

/**
 * DELETE /api/events/:id/signup
 * Cancel signup for an event (authenticated users)
 */
router.delete('/:id/signup', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    await eventService.cancelSignup(req.params.id, req.user.userId);
    res.json({ message: 'Signup cancelled' });
  } catch (error: any) {
    console.error('Error cancelling signup:', error);
    res.status(400).json({ error: error.message || 'Failed to cancel signup' });
  }
});

/**
 * GET /api/events/:id/signups
 * Get signups for an event (public)
 */
router.get('/:id/signups', async (req: Request, res: Response) => {
  try {
    const signups = await eventService.getEventSignups(req.params.id);
    res.json(signups);
  } catch (error) {
    console.error('Error fetching signups:', error);
    res.status(500).json({ error: 'Failed to fetch signups' });
  }
});

/**
 * PUT /api/events/:id/checkin/:userId
 * Check in a player (Admin/Tournament Director)
 */
router.put('/:id/checkin/:userId', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const signup = await eventService.checkInPlayer(req.params.id, req.params.userId);
    res.json(signup);
  } catch (error) {
    console.error('Error checking in player:', error);
    res.status(500).json({ error: 'Failed to check in player' });
  }
});

/**
 * DELETE /api/events/:id/signup/:userId
 * Remove a player from an event (Admin/Tournament Director)
 * Sets their signup status to CANCELLED
 */
router.delete('/:id/signup/:userId', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const userId = req.params.userId;

    const signup = await prisma.eventSignup.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (!signup) {
      return res.status(404).json({ error: 'Signup not found' });
    }

    if (signup.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Signup is already cancelled' });
    }

    const wasRegistered = signup.status === 'REGISTERED' || signup.status === 'CHECKED_IN';

    await prisma.eventSignup.update({
      where: { id: signup.id },
      data: { status: 'CANCELLED' },
    });

    // If a registered/checked-in player was removed and there's a waitlist, promote the next person
    if (wasRegistered) {
      const event = await prisma.event.findUnique({ where: { id: eventId } });
      if (event) {
        const nextWaitlisted = await prisma.eventSignup.findFirst({
          where: { eventId, status: 'WAITLISTED' },
          orderBy: { registeredAt: 'asc' },
        });
        if (nextWaitlisted) {
          await prisma.eventSignup.update({
            where: { id: nextWaitlisted.id },
            data: { status: 'REGISTERED' },
          });
        }
      }
    }

    res.json({ message: 'Player removed from event' });
  } catch (error) {
    console.error('Error removing player:', error);
    res.status(500).json({ error: 'Failed to remove player' });
  }
});

// ============================================
// RESULTS ENDPOINTS
// ============================================

/**
 * POST /api/events/:id/results
 * Enter results for an event (Admin/Tournament Director)
 */
router.post('/:id/results', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const validation = bulkResultsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const results = await eventService.enterResults(req.params.id, validation.data.results);
    res.json(results);
  } catch (error: any) {
    console.error('Error entering results:', error);
    res.status(400).json({ error: error.message || 'Failed to enter results' });
  }
});

/**
 * GET /api/events/:id/results
 * Get results for an event (public)
 */
router.get('/:id/results', async (req: Request, res: Response) => {
  try {
    const results = await eventService.getEventResults(req.params.id);
    res.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

/**
 * GET /api/events/:id/points-preview
 * Get points preview based on current checked-in count (public)
 */
router.get('/:id/points-preview', async (req: Request, res: Response) => {
  try {
    const preview = await eventService.getPointsPreview(req.params.id);
    res.json(preview);
  } catch (error) {
    console.error('Error fetching points preview:', error);
    res.status(500).json({ error: 'Failed to fetch points preview' });
  }
});

/**
 * GET /api/events/:id/waitlist-position
 * Get user's waitlist position for an event (authenticated)
 */
router.get('/:id/waitlist-position', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const position = await eventService.getWaitlistPosition(req.params.id, req.user.userId);
    res.json({ position });
  } catch (error) {
    console.error('Error fetching waitlist position:', error);
    res.status(500).json({ error: 'Failed to fetch waitlist position' });
  }
});

// ============================================
// QUICK ADD PLAYER (Tournament Director)
// ============================================

/**
 * GET /api/events/:id/search-players
 * Search users by name for quick-add (TD/Admin only)
 * Excludes users already signed up for this event
 */
router.get('/:id/search-players', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || '').trim();
    if (query.length < 2) {
      return res.json([]);
    }

    const eventId = req.params.id;

    // Get users already signed up for this event
    const existingSignups = await prisma.eventSignup.findMany({
      where: { eventId, status: { not: 'CANCELLED' } },
      select: { userId: true },
    });
    const excludeIds = existingSignups.map(s => s.userId);

    // Search users by name (case-insensitive)
    const users = await prisma.user.findMany({
      where: {
        name: { contains: query, mode: 'insensitive' },
        isActive: true,
        id: { notIn: excludeIds },
      },
      select: {
        id: true,
        name: true,
        email: true,
        isGuest: true,
      },
      take: 10,
      orderBy: { name: 'asc' },
    });

    res.json(users);
  } catch (error) {
    console.error('Error searching players:', error);
    res.status(500).json({ error: 'Failed to search players' });
  }
});

/**
 * POST /api/events/:id/quick-add
 * Quick-add an existing user to an event (TD/Admin only)
 * Bypasses normal signup flow (no maxPlayers/waitlist check)
 * Body: { userId: string } for existing user
 *   OR  { name: string } for creating a guest stub account
 */
router.post('/:id/quick-add', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { userId, name } = req.body;

    // Verify event exists
    const event = await eventService.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    let targetUserId: string;

    if (userId) {
      // Adding an existing user
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      targetUserId = userId;
    } else if (name && name.trim().length >= 2) {
      // Create a guest stub account
      const guestUser = await prisma.user.create({
        data: {
          name: name.trim(),
          isGuest: true,
          authProvider: 'EMAIL', // placeholder
        },
      });
      targetUserId = guestUser.id;
    } else {
      return res.status(400).json({ error: 'Either userId or name (min 2 chars) is required' });
    }

    // Check if already signed up
    const existingSignup = await prisma.eventSignup.findUnique({
      where: { eventId_userId: { eventId, userId: targetUserId } },
    });

    if (existingSignup && existingSignup.status !== 'CANCELLED') {
      return res.status(400).json({ error: 'Player is already signed up for this event' });
    }

    // Create or update signup (reactivate if previously cancelled)
    let signup;
    if (existingSignup) {
      signup = await prisma.eventSignup.update({
        where: { id: existingSignup.id },
        data: { status: 'REGISTERED', registeredAt: new Date() },
        include: { user: { select: { id: true, name: true, isGuest: true } } },
      });
    } else {
      signup = await prisma.eventSignup.create({
        data: {
          eventId,
          userId: targetUserId,
          status: 'REGISTERED',
        },
        include: { user: { select: { id: true, name: true, isGuest: true } } },
      });
    }

    res.status(201).json(signup);
  } catch (error: any) {
    console.error('Error quick-adding player:', error);
    res.status(500).json({ error: error.message || 'Failed to quick-add player' });
  }
});

// ============================================
// TOTAL ENTRANTS OVERRIDE (Tournament Director)
// ============================================

/**
 * PUT /api/events/:id/total-entrants
 * Set or clear the total entrants override for an event (TD/Admin only)
 * Body: { totalEntrants: number | null }
 */
router.put('/:id/total-entrants', authenticate, requireTournamentDirector, async (req: Request, res: Response) => {
  try {
    const eventId = req.params.id;
    const { totalEntrants } = req.body;

    // Validate: must be null or a positive integer
    if (totalEntrants !== null && totalEntrants !== undefined) {
      const num = Number(totalEntrants);
      if (!Number.isInteger(num) || num < 1) {
        return res.status(400).json({ error: 'totalEntrants must be a positive integer or null' });
      }
    }

    const result = await eventService.setTotalEntrants(
      eventId,
      totalEntrants === null || totalEntrants === undefined ? null : Number(totalEntrants)
    );
    res.json(result);
  } catch (error: any) {
    console.error('Error setting total entrants:', error);
    res.status(500).json({ error: error.message || 'Failed to set total entrants' });
  }
});

export default router;
