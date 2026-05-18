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
  debitBalance,
  getBalanceStats,
  initiateWithdrawal,
  getUserTransactions,
  getAllTransactions,
} from '../services/balance.service';
import { getWithdrawalWithLnurl } from '../services/withdrawal.service';
import {
  createDeposit,
  getDepositLimits,
  getDepositStatus,
  getUserDeposits,
} from '../services/deposit.service';
import { depositCreateLimiter, depositStatusLimiter } from '../middleware/rateLimiter';

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

/**
 * GET /api/balance/deposit/limits
 *
 * Get deposit limits and invoice expiry for UI validation.
 */
router.get('/deposit/limits', authenticate, async (_req: Request, res: Response) => {
  return res.json(getDepositLimits());
});

/**
 * POST /api/balance/deposit
 *
 * Create a Lightning invoice to deposit sats into user's balance.
 */
router.post('/deposit', authenticate, depositCreateLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { amountSats } = req.body;
    const result = await createDeposit(userId, amountSats);
    return res.status(201).json(result);
  } catch (error) {
    console.error('[Balance] Create deposit error:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Failed to create deposit invoice',
    });
  }
});

/**
 * GET /api/balance/deposit/:id/status
 *
 * Check and settle a deposit invoice if paid.
 */
router.get('/deposit/:id/status', authenticate, depositStatusLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const result = await getDepositStatus(userId, req.params.id);
    return res.json(result);
  } catch (error) {
    console.error('[Balance] Get deposit status error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get deposit status';
    const status = message === 'Deposit not found' ? 404 : message === 'Not authorized' ? 403 : 500;
    return res.status(status).json({ error: message });
  }
});

/**
 * GET /api/balance/deposits
 *
 * Get current user's recent Lightning deposits.
 */
router.get('/deposits', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 25, 100);
    const deposits = await getUserDeposits(userId, limit);
    return res.json(deposits);
  } catch (error) {
    console.error('[Balance] Get deposits error:', error);
    return res.status(500).json({ error: 'Failed to get deposits' });
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
    const adminId = req.user?.userId;

    if (!userId || !amountSats) {
      return res.status(400).json({ error: 'userId and amountSats are required' });
    }

    if (amountSats < 1) {
      return res.status(400).json({ error: 'Amount must be at least 1 sat' });
    }

    const result = await creditBalance(userId, amountSats, reason, adminId);
    return res.json(result);
  } catch (error) {
    console.error('[Balance] Credit error:', error);
    return res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to credit balance' 
    });
  }
});

/**
 * POST /api/balance/admin/debit
 * 
 * Debit sats from a user's balance (admin only)
 */
router.post('/admin/debit', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, amountSats, reason } = req.body;
    const adminId = req.user?.userId;

    if (!userId || !amountSats) {
      return res.status(400).json({ error: 'userId and amountSats are required' });
    }

    if (amountSats < 1) {
      return res.status(400).json({ error: 'Amount must be at least 1 sat' });
    }

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'A reason/note is required for debits' });
    }

    const result = await debitBalance(userId, amountSats, reason, adminId);
    return res.json(result);
  } catch (error) {
    console.error('[Balance] Debit error:', error);
    return res.status(400).json({ 
      error: error instanceof Error ? error.message : 'Failed to debit balance' 
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

/**
 * GET /api/balance/admin/user/:userId/transactions
 * 
 * Get transaction history for a specific user (admin only)
 */
router.get('/admin/user/:userId/transactions', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = await getUserTransactions(req.params.userId, limit);
    return res.json(transactions);
  } catch (error) {
    console.error('[Balance] Get user transactions error:', error);
    return res.status(500).json({ error: 'Failed to get transactions' });
  }
});

/**
 * GET /api/balance/admin/transactions
 * 
 * Get all transactions across all users (admin only) — paginated
 */
router.get('/admin/transactions', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string | undefined;

    const result = await getAllTransactions(limit, offset, type);
    return res.json(result);
  } catch (error) {
    console.error('[Balance] Get all transactions error:', error);
    return res.status(500).json({ error: 'Failed to get transactions' });
  }
});

export default router;
