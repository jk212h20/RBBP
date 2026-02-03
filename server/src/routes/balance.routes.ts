/**
 * Balance Routes
 * 
 * API endpoints for managing user Lightning balances.
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import {
  getUserBalance,
  getAllUsersWithBalances,
  getUsersWithBalances,
  creditBalance,
  getBalanceStats,
  initiateWithdrawal,
} from '../services/balance.service';
import { getWithdrawalWithLnurl } from '../services/withdrawal.service';

const router = Router();

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * GET /api/balance
 * 
 * Get current user's Lightning balance
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const balanceSats = await getUserBalance(userId);
    return res.json({ balanceSats });
  } catch (error) {
    console.error('[Balance] Get balance error:', error);
    return res.status(500).json({ error: 'Failed to get balance' });
  }
});

/**
 * POST /api/balance/withdraw
 * 
 * Initiate a withdrawal from user's balance
 * Returns LNURL-withdraw QR code for user to scan
 */
router.post('/withdraw', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { amountSats } = req.body;

    const result = await initiateWithdrawal(userId, amountSats);
    return res.json(result);
  } catch (error) {
    console.error('[Balance] Withdraw error:', error);
    return res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to initiate withdrawal' 
    });
  }
});

/**
 * GET /api/balance/withdrawal/:id/status
 * 
 * Check the status of a withdrawal (for polling)
 */
router.get('/withdrawal/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const withdrawal = await getWithdrawalWithLnurl(req.params.id);
    
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    // Only allow users to check their own withdrawals
    if (withdrawal.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    return res.json({
      id: withdrawal.id,
      status: withdrawal.status,
      amountSats: withdrawal.amountSats,
      paidAt: withdrawal.paidAt,
    });
  } catch (error) {
    console.error('[Balance] Get withdrawal status error:', error);
    return res.status(500).json({ error: 'Failed to get withdrawal status' });
  }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * GET /api/balance/admin/all
 * 
 * Get all users with their balances (admin only)
 */
router.get('/admin/all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await getAllUsersWithBalances();
    return res.json(users);
  } catch (error) {
    console.error('[Balance] Get all balances error:', error);
    return res.status(500).json({ error: 'Failed to get balances' });
  }
});

/**
 * GET /api/balance/admin/with-balance
 * 
 * Get users with non-zero balances (admin only)
 */
router.get('/admin/with-balance', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await getUsersWithBalances();
    return res.json(users);
  } catch (error) {
    console.error('[Balance] Get users with balance error:', error);
    return res.status(500).json({ error: 'Failed to get balances' });
  }
});

/**
 * GET /api/balance/admin/stats
 * 
 * Get balance statistics (admin only)
 */
router.get('/admin/stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await getBalanceStats();
    return res.json(stats);
  } catch (error) {
    console.error('[Balance] Get stats error:', error);
    return res.status(500).json({ error: 'Failed to get stats' });
  }
});

/**
 * POST /api/balance/admin/credit
 * 
 * Credit sats to a user's balance (admin only)
 */
router.post('/admin/credit', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, amountSats, reason } = req.body;

    if (!userId || !amountSats) {
      return res.status(400).json({ error: 'userId and amountSats are required' });
    }

    if (amountSats < 1) {
      return res.status(400).json({ error: 'Amount must be at least 1 sat' });
    }

    const result = await creditBalance(userId, amountSats, reason);
    return res.json(result);
  } catch (error) {
    console.error('[Balance] Credit error:', error);
    return res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to credit balance' 
    });
  }
});

/**
 * GET /api/balance/admin/user/:userId
 * 
 * Get a specific user's balance (admin only)
 */
router.get('/admin/user/:userId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const balanceSats = await getUserBalance(req.params.userId);
    return res.json({ userId: req.params.userId, balanceSats });
  } catch (error) {
    console.error('[Balance] Get user balance error:', error);
    return res.status(500).json({ error: 'Failed to get balance' });
  }
});

export default router;
