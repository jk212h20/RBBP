import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import {
  createVenueMedia,
  deleteVenueMedia,
  listVenueMedia,
  updateVenueMedia,
} from '../services/venue-media.service';

const router = Router();

router.get('/venues/:venueId/media', async (req: Request, res: Response) => {
  try {
    const media = await listVenueMedia(req.params.venueId);
    res.json({ media });
  } catch (error) {
    console.error('[VenueMedia] List error:', error);
    res.status(500).json({ error: 'Failed to load venue media' });
  }
});

router.post('/venues/:venueId/media', authenticate, requireRole(UserRole.ADMIN, UserRole.VENUE_MANAGER), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role as UserRole | undefined;
    if (!userId || !role) return res.status(401).json({ error: 'Not authenticated' });

    const media = await createVenueMedia(req.params.venueId, userId, role, req.body);
    res.status(201).json(media);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to add media' });
  }
});

router.put('/media/:mediaId', authenticate, requireRole(UserRole.ADMIN, UserRole.VENUE_MANAGER), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role as UserRole | undefined;
    if (!userId || !role) return res.status(401).json({ error: 'Not authenticated' });

    const media = await updateVenueMedia(req.params.mediaId, userId, role, req.body);
    res.json(media);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update media' });
  }
});

router.delete('/media/:mediaId', authenticate, requireRole(UserRole.ADMIN, UserRole.VENUE_MANAGER), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role as UserRole | undefined;
    if (!userId || !role) return res.status(401).json({ error: 'Not authenticated' });

    const result = await deleteVenueMedia(req.params.mediaId, userId, role);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to delete media' });
  }
});

export default router;
