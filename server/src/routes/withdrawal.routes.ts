/**
 * Withdrawal Routes
 * 
 * Admin API for managing Lightning withdrawals.
 * These endpoints are called by our frontend, not by wallets.
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import {
  createWithdrawal,
  getAllWithdrawals,
  getUserWithdrawals,
  getWithdrawalWithLnurl,
  cancelWithdrawal,
  getWithdrawalStats,
  cleanupExpiredWithdrawals,
} from '../services/withdrawal.service';
import { verifyConnection, getChannelBalance, isVoltageConfigured } from '../services/voltage.service';

const router = Router();

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * POST /api/withdrawals
 * 
 * Create a new withdrawal for a user (admin only)
 */
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, amountSats, description, expiresInHours } = req.body;

    if (!userId || !amountSats) {
      return res.status(400).json({ error: 'userId and amountSats are required' });
    }

    if (amountSats < 1) {
      return res.status(400).json({ error: 'Amount must be at least 1 sat' });
    }

    const result = await createWithdrawal(userId, amountSats, description, expiresInHours);
    return res.status(201).json(result);
  } catch (error) {
    console.error('[Withdrawal] Create error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create withdrawal' 
    });
  }
});

/**
 * GET /api/withdrawals
 * 
 * Get all withdrawals (admin only)
 */
router.get('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, userId, limit } = req.query;

    const withdrawals = await getAllWithdrawals({
      status: status as any,
      userId: userId as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    return res.json(withdrawals);
  } catch (error) {
    console.error('[Withdrawal] List error:', error);
    return res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

/**
 * GET /api/withdrawals/stats
 * 
 * Get withdrawal statistics (admin only)
 */
router.get('/stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getWithdrawalStats();
    return res.json(stats);
  } catch (error) {
    console.error('[Withdrawal] Stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

/**
 * GET /api/withdrawals/node-status
 * 
 * Get Lightning node status (admin only)
 */
router.get('/node-status', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    if (!isVoltageConfigured()) {
      return res.json({ 
        configured: false, 
        connected: false,
        error: 'Voltage not configured. Set VOLTAGE_REST_HOST and VOLTAGE_MACAROON.' 
      });
    }

    const connection = await verifyConnection();
    
    if (!connection.connected) {
      return res.json({ 
        configured: true, 
        connected: false, 
        error: connection.error 
      });
    }

    const balance = await getChannelBalance();

    return res.json({
      configured: true,
      connected: true,
      nodeAlias: connection.nodeAlias,
      balanceSats: balance.balanceSats,
      pendingSats: balance.pendingSats,
    });
  } catch (error) {
    console.error('[Withdrawal] Node status error:', error);
    return res.status(500).json({ 
      configured: isVoltageConfigured(),
      connected: false,
      error: error instanceof Error ? error.message : 'Failed to check node status' 
    });
  }
});

/**
 * POST /api/withdrawals/cleanup
 * 
 * Clean up expired withdrawals (admin only)
 */
router.post('/cleanup', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const count = await cleanupExpiredWithdrawals();
    return res.json({ message: `Cleaned up ${count} expired withdrawals` });
  } catch (error) {
    console.error('[Withdrawal] Cleanup error:', error);
    return res.status(500).json({ error: 'Failed to cleanup withdrawals' });
  }
});

/**
 * GET /api/withdrawals/:id
 * 
 * Get a single withdrawal with LNURL data (admin only)
 */
router.get('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const withdrawal = await getWithdrawalWithLnurl(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    return res.json(withdrawal);
  } catch (error) {
    console.error('[Withdrawal] Get error:', error);
    return res.status(500).json({ error: 'Failed to fetch withdrawal' });
  }
});

/**
 * DELETE /api/withdrawals/:id
 * 
 * Cancel a pending withdrawal (admin only)
 */
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const success = await cancelWithdrawal(req.params.id);

    if (!success) {
      return res.status(400).json({ error: 'Cannot cancel withdrawal (not found or not pending)' });
    }

    return res.json({ message: 'Withdrawal cancelled' });
  } catch (error) {
    console.error('[Withdrawal] Cancel error:', error);
    return res.status(500).json({ error: 'Failed to cancel withdrawal' });
  }
});

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * GET /api/withdrawals/my
 * 
 * Get current user's withdrawals
 */
router.get('/my', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const withdrawals = await getUserWithdrawals(userId);
    return res.json(withdrawals);
  } catch (error) {
    console.error('[Withdrawal] My withdrawals error:', error);
    return res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

/**
 * GET /api/withdrawals/my/:id
 * 
 * Get a specific withdrawal for current user (with LNURL if pending)
 */
router.get('/my/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const withdrawal = await getWithdrawalWithLnurl(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    // Verify this withdrawal belongs to the user
    if (withdrawal.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    return res.json(withdrawal);
  } catch (error) {
    console.error('[Withdrawal] My withdrawal error:', error);
    return res.status(500).json({ error: 'Failed to fetch withdrawal' });
  }
});

export default router;
