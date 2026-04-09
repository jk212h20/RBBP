import { Router, Request, Response } from 'express';
import { sideBetService, getSideBetFeePct } from '../services/side-bet.service';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// List open side bets (optionally filter by eventId)
router.get('/', async (req: Request, res: Response) => {
  try {
    const eventId = req.query.eventId as string | undefined;
    const bets = await sideBetService.listOpen(eventId);
    res.json(bets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get my bets (created + entered) — must be before /:id
router.get('/my/all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const bets = await sideBetService.getUserBets(userId);
    res.json(bets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get bets for a player (public profile)
router.get('/player/:playerId', async (req: Request, res: Response) => {
  try {
    const bets = await sideBetService.getPlayerBets(req.params.playerId);
    res.json(bets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin settings — must be before /:id
router.get('/admin/settings', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  res.json({ feePct: getSideBetFeePct() });
});

router.put('/admin/settings', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { feePct } = req.body;
    if (feePct === undefined || feePct < 0 || feePct > 50) {
      return res.status(400).json({ error: 'feePct must be between 0 and 50' });
    }
    process.env.SIDE_BET_FEE_PCT = String(feePct);
    res.json({ message: 'Side bet fee updated', feePct });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: list ALL side bets
router.get('/admin/all', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const bets = await sideBetService.listAll();
    res.json(bets);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: settle any bet (bypass creator check)
router.post('/admin/:id/settle', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { winnerId } = req.body;
    if (!winnerId) return res.status(400).json({ error: 'winnerId is required' });
    const result = await sideBetService.adminSettleSideBet(req.params.id, winnerId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Admin: cancel any bet (bypass creator check)
router.post('/admin/:id/cancel', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await sideBetService.adminCancelSideBet(req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get side bet details (after all named routes)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bet = await sideBetService.getSideBet(req.params.id);
    res.json(bet);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create a new side bet (creator must pay to activate)
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { label, description, entrySats, eventId } = req.body;

    if (!label || !entrySats) {
      return res.status(400).json({ error: 'label and entrySats are required' });
    }

    const result = await sideBetService.createSideBet({
      label,
      description: description || undefined,
      entrySats: parseInt(entrySats),
      creatorId: userId,
      eventId: eventId || undefined,
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Enter a side bet (generate invoice)
router.post('/:id/enter', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const result = await sideBetService.enterSideBet(req.params.id, userId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Check payment status
router.get('/:id/check-payment', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const result = await sideBetService.checkPayment(req.params.id, userId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Settle (pick winner) — creator only
router.post('/:id/settle', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { winnerId } = req.body;
    if (!winnerId) return res.status(400).json({ error: 'winnerId is required' });

    const result = await sideBetService.settleSideBet(req.params.id, winnerId, userId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Cancel — creator only
router.post('/:id/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const result = await sideBetService.cancelSideBet(req.params.id, userId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
