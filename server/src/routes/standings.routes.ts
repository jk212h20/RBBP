import { Router, Request, Response } from 'express';
import { standingsService } from '../services/standings.service';

const router = Router();

// GET /api/standings - Get current season standings
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await standingsService.getCurrentStandings();
    res.json(result);
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// GET /api/standings/current - Alias for current standings
router.get('/current', async (req: Request, res: Response) => {
  try {
    const result = await standingsService.getCurrentStandings();
    res.json(result);
  } catch (error) {
    console.error('Error fetching current standings:', error);
    res.status(500).json({ error: 'Failed to fetch standings' });
  }
});

// GET /api/standings/season/:seasonId - Get standings for specific season
router.get('/season/:seasonId', async (req: Request, res: Response) => {
  try {
    const { seasonId } = req.params;
    const result = await standingsService.getSeasonStandings(seasonId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching season standings:', error);
    res.status(500).json({ error: 'Failed to fetch season standings' });
  }
});

// GET /api/standings/player/:playerId - Get player's standings history
router.get('/player/:playerId', async (req: Request, res: Response) => {
  try {
    const { playerId } = req.params;
    const result = await standingsService.getPlayerStandings(playerId);
    res.json(result);
  } catch (error) {
    console.error('Error fetching player standings:', error);
    res.status(500).json({ error: 'Failed to fetch player standings' });
  }
});

export default router;
