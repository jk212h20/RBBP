import { Router, Request, Response } from 'express';
import { venueService } from '../services/venue.service';
import { createVenueSchema, updateVenueSchema } from '../validators/venue.validator';
import { authenticate, requireRole, requireAdmin, requireVenueManager } from '../middleware/auth.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

/**
 * GET /api/venues/my/managed
 * Get venues managed by current user
 * NOTE: This route must be defined BEFORE /:id to avoid conflicts
 */
router.get('/my/managed', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const venues = await venueService.getVenuesByManager(req.user.userId);
    res.json(venues);
  } catch (error) {
    console.error('Error fetching managed venues:', error);
    res.status(500).json({ error: 'Failed to fetch managed venues' });
  }
});

/**
 * GET /api/venues
 * Get all venues (public)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const venues = await venueService.getAllVenues(includeInactive);
    res.json(venues);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

/**
 * GET /api/venues/:id
 * Get venue by ID (public)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const venue = await venueService.getVenueById(req.params.id);
    
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    
    res.json(venue);
  } catch (error) {
    console.error('Error fetching venue:', error);
    res.status(500).json({ error: 'Failed to fetch venue' });
  }
});

/**
 * POST /api/venues
 * Create a new venue (Admin only)
 */
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const validation = createVenueSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const venue = await venueService.createVenue(validation.data, req.body.managerId);
    res.status(201).json(venue);
  } catch (error) {
    console.error('Error creating venue:', error);
    res.status(500).json({ error: 'Failed to create venue' });
  }
});

/**
 * PUT /api/venues/:id
 * Update a venue (Admin or Venue Manager)
 */
router.put('/:id', authenticate, requireVenueManager, async (req: Request, res: Response) => {
  try {
    const venueId = req.params.id;
    
    // Check if venue exists
    const existingVenue = await venueService.getVenueById(venueId);
    if (!existingVenue) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    
    // If user is venue manager, verify they manage this venue
    if (req.user?.role === UserRole.VENUE_MANAGER && existingVenue.managerId !== req.user.userId) {
      return res.status(403).json({ error: 'You can only edit venues you manage' });
    }
    
    const validation = updateVenueSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const venue = await venueService.updateVenue(venueId, validation.data);
    res.json(venue);
  } catch (error) {
    console.error('Error updating venue:', error);
    res.status(500).json({ error: 'Failed to update venue' });
  }
});

/**
 * DELETE /api/venues/:id
 * Delete a venue (Admin only) - soft delete
 */
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = req.params.id;
    
    // Check if venue exists
    const existingVenue = await venueService.getVenueById(venueId);
    if (!existingVenue) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    
    const hardDelete = req.query.hard === 'true';
    
    if (hardDelete) {
      await venueService.hardDeleteVenue(venueId);
      res.json({ message: 'Venue permanently deleted' });
    } else {
      await venueService.deleteVenue(venueId);
      res.json({ message: 'Venue deactivated' });
    }
  } catch (error: any) {
    console.error('Error deleting venue:', error);
    res.status(500).json({ error: error.message || 'Failed to delete venue' });
  }
});

/**
 * PUT /api/venues/:id/manager
 * Assign a manager to a venue (Admin only)
 */
router.put('/:id/manager', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = req.params.id;
    const { managerId } = req.body;
    
    const venue = await venueService.assignManager(venueId, managerId || null);
    res.json(venue);
  } catch (error) {
    console.error('Error assigning manager:', error);
    res.status(500).json({ error: 'Failed to assign manager' });
  }
});

export default router;
