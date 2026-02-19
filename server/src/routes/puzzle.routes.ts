import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import * as puzzleService from '../services/puzzle.service';

const router = Router();

// ============================================
// PLAYER ENDPOINTS
// ============================================

// GET /api/puzzle/today - Get today's puzzle (auth required)
router.get('/today', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const eligible = await puzzleService.isEligible(userId);

    // If user just became eligible, release any pending sats
    let satsReleased = 0;
    if (eligible) {
      satsReleased = await puzzleService.releasePendingSats(userId);
    }

    const data = await puzzleService.getTodaysPuzzle(userId);
    const pendingSats = eligible ? 0 : await puzzleService.getPendingSats(userId);

    res.json({
      ...data,
      eligible,
      pendingSats,
      satsReleased, // > 0 if sats were just released on this request
    });
  } catch (error) {
    console.error('Error fetching today\'s puzzle:', error);
    res.status(500).json({ error: 'Failed to fetch puzzle' });
  }
});

// GET /api/puzzle/yesterday - Get yesterday's catch-up puzzle (auth required)
router.get('/yesterday', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const data = await puzzleService.getYesterdaysPuzzle(userId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching yesterday\'s puzzle:', error);
    res.status(500).json({ error: 'Failed to fetch puzzle' });
  }
});

// POST /api/puzzle/answer - Submit an answer (auth required)
router.post('/answer', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { puzzleId, selectedIndex, isYesterdayAttempt } = req.body;

    if (!puzzleId || selectedIndex === undefined || selectedIndex === null) {
      res.status(400).json({ error: 'puzzleId and selectedIndex are required' });
      return;
    }

    if (typeof selectedIndex !== 'number' || selectedIndex < 0 || selectedIndex > 4) {
      res.status(400).json({ error: 'selectedIndex must be 0-4' });
      return;
    }

    const result = await puzzleService.submitAnswer(userId, puzzleId, selectedIndex, !!isYesterdayAttempt);
    res.json(result);
  } catch (error: any) {
    console.error('Error submitting puzzle answer:', error);
    res.status(400).json({ error: error.message || 'Failed to submit answer' });
  }
});

// GET /api/puzzle/streak - Get current streak (auth required)
router.get('/streak', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const streak = await puzzleService.getStreak(userId);
    res.json({ streak });
  } catch (error) {
    console.error('Error fetching streak:', error);
    res.status(500).json({ error: 'Failed to fetch streak' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

// GET /api/puzzle/admin/all - Get all puzzles (admin)
router.get('/admin/all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const puzzles = await puzzleService.getAllPuzzles();
    res.json(puzzles);
  } catch (error) {
    console.error('Error fetching all puzzles:', error);
    res.status(500).json({ error: 'Failed to fetch puzzles' });
  }
});

// GET /api/puzzle/admin/stats - Get puzzle stats (admin)
router.get('/admin/stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await puzzleService.getPuzzleStats();
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching puzzle stats:', error?.message || error);
    // Return empty stats instead of error so admin page still works
    res.json({
      totalPuzzles: 0,
      usedPuzzles: 0,
      queuedPuzzles: 0,
      totalAttempts: 0,
      correctAttempts: 0,
      accuracy: 0,
      totalSatsAwarded: 0,
    });
  }
});

// POST /api/puzzle/admin - Create puzzle (admin)
router.post('/admin', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { scenario, question, options, correctIndex, explanation, rewardSats, imageUrl } = req.body;

    if (!scenario || !question || !options || correctIndex === undefined || !explanation) {
      res.status(400).json({ error: 'scenario, question, options, correctIndex, and explanation are required' });
      return;
    }

    if (!Array.isArray(options) || options.length < 2 || options.length > 5) {
      res.status(400).json({ error: 'options must be an array of 2-5 strings' });
      return;
    }

    const puzzle = await puzzleService.createPuzzle({
      scenario, question, options, correctIndex, explanation, rewardSats, imageUrl,
    });
    res.status(201).json(puzzle);
  } catch (error: any) {
    console.error('Error creating puzzle:', error);
    res.status(500).json({ error: 'Failed to create puzzle' });
  }
});

// POST /api/puzzle/admin/reorder - Reorder queued puzzles (admin)
router.post('/admin/reorder', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      res.status(400).json({ error: 'orderedIds must be an array of puzzle IDs' });
      return;
    }
    const result = await puzzleService.reorderPuzzles(orderedIds);
    res.json(result);
  } catch (error) {
    console.error('Error reordering puzzles:', error);
    res.status(500).json({ error: 'Failed to reorder puzzles' });
  }
});

// PUT /api/puzzle/admin/:id - Update puzzle (admin)
router.put('/admin/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const puzzle = await puzzleService.updatePuzzle(id, req.body);
    res.json(puzzle);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    console.error('Error updating puzzle:', error);
    res.status(500).json({ error: 'Failed to update puzzle' });
  }
});

// DELETE /api/puzzle/admin/:id - Delete puzzle (admin)
router.delete('/admin/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await puzzleService.deletePuzzle(id);
    res.json({ message: 'Puzzle deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Puzzle not found' });
      return;
    }
    console.error('Error deleting puzzle:', error);
    res.status(500).json({ error: 'Failed to delete puzzle' });
  }
});

export default router;
