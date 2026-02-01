import { Router, Request, Response } from 'express';
import { seasonService } from '../services/season.service';
import { createSeasonSchema, updateSeasonSchema } from '../validators/season.validator';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/seasons/current
 * Get the current active season (public)
 * NOTE: This must be before /:id to avoid conflicts
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const season = await seasonService.getCurrentSeason();
    
    if (!season) {
      return res.status(404).json({ error: 'No active season found' });
    }
    
    res.json(season);
  } catch (error) {
    console.error('Error fetching current season:', error);
    res.status(500).json({ error: 'Failed to fetch current season' });
  }
});

/**
 * GET /api/seasons
 * Get all seasons (public)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const seasons = await seasonService.getAllSeasons();
    res.json(seasons);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

/**
 * GET /api/seasons/:id
 * Get season by ID with events and standings (public)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const season = await seasonService.getSeasonById(req.params.id);
    
    if (!season) {
      return res.status(404).json({ error: 'Season not found' });
    }
    
    res.json(season);
  } catch (error) {
    console.error('Error fetching season:', error);
    res.status(500).json({ error: 'Failed to fetch season' });
  }
});

/**
 * GET /api/seasons/:id/standings
 * Get standings/leaderboard for a season (public)
 */
router.get('/:id/standings', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const standings = await seasonService.getSeasonStandings(req.params.id, limit);
    res.json(standings);
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

/**
 * POST /api/seasons
 * Create a new season (Admin only)
 */
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const validation = createSeasonSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const season = await seasonService.createSeason(validation.data);
    res.status(201).json(season);
  } catch (error) {
    console.error('Error creating season:', error);
    res.status(500).json({ error: 'Failed to create season' });
  }
});

/**
 * PUT /api/seasons/:id
 * Update a season (Admin only)
 */
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const seasonId = req.params.id;
    
    // Check if season exists
    const existingSeason = await seasonService.getSeasonById(seasonId);
    if (!existingSeason) {
      return res.status(404).json({ error: 'Season not found' });
    }
    
    const validation = updateSeasonSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validation.error.errors 
      });
    }
    
    const season = await seasonService.updateSeason(seasonId, validation.data);
    res.json(season);
  } catch (error) {
    console.error('Error updating season:', error);
    res.status(500).json({ error: 'Failed to update season' });
  }
});

/**
 * PUT /api/seasons/:id/activate
 * Activate a season (Admin only)
 */
router.put('/:id/activate', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const seasonId = req.params.id;
    
    const season = await seasonService.activateSeason(seasonId);
    res.json(season);
  } catch (error) {
    console.error('Error activating season:', error);
    res.status(500).json({ error: 'Failed to activate season' });
  }
});

/**
 * POST /api/seasons/:id/recalculate
 * Recalculate standings for a season (Admin only)
 */
router.post('/:id/recalculate', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const seasonId = req.params.id;
    
    const standings = await seasonService.recalculateStandings(seasonId);
    res.json({
      message: 'Standings recalculated',
      standings,
    });
  } catch (error) {
    console.error('Error recalculating standings:', error);
    res.status(500).json({ error: 'Failed to recalculate standings' });
  }
});

/**
 * DELETE /api/seasons/:id
 * Delete a season (Admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const seasonId = req.params.id;
    
    await seasonService.deleteSeason(seasonId);
    res.json({ message: 'Season deleted' });
  } catch (error: any) {
    console.error('Error deleting season:', error);
    res.status(500).json({ error: error.message || 'Failed to delete season' });
  }
});

export default router;
