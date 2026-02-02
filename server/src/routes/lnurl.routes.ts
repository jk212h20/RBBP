/**
 * LNURL Routes
 * 
 * These endpoints implement the LNURL-withdraw protocol (LUD-03).
 * They are called by Lightning wallets, not by our frontend.
 * 
 * Flow:
 * 1. User scans QR code containing LNURL
 * 2. Wallet decodes LNURL and calls GET /api/lnurl/withdraw?k1=xxx
 * 3. We return withdrawal details (amount, callback URL)
 * 4. Wallet generates invoice and calls GET /api/lnurl/withdraw/callback?k1=xxx&pr=lnbc...
 * 5. We pay the invoice
 */

import { Router, Request, Response } from 'express';
import { handleWithdrawRequest, handleWithdrawCallback } from '../services/withdrawal.service';

const router = Router();

/**
 * GET /api/lnurl/withdraw
 * 
 * Initial LNURL-withdraw request from wallet.
 * Returns withdrawal details per LUD-03 spec.
 */
router.get('/withdraw', async (req: Request, res: Response) => {
  try {
    const { k1 } = req.query;

    if (!k1 || typeof k1 !== 'string') {
      return res.json({ status: 'ERROR', reason: 'Missing k1 parameter' });
    }

    const result = await handleWithdrawRequest(k1);
    return res.json(result);
  } catch (error) {
    console.error('[LNURL] Withdraw request error:', error);
    return res.json({ 
      status: 'ERROR', 
      reason: error instanceof Error ? error.message : 'Internal error' 
    });
  }
});

/**
 * GET /api/lnurl/withdraw/callback
 * 
 * Wallet submits invoice for payment.
 * We pay the invoice and return success/error.
 */
router.get('/withdraw/callback', async (req: Request, res: Response) => {
  try {
    const { k1, pr } = req.query;

    if (!k1 || typeof k1 !== 'string') {
      return res.json({ status: 'ERROR', reason: 'Missing k1 parameter' });
    }

    if (!pr || typeof pr !== 'string') {
      return res.json({ status: 'ERROR', reason: 'Missing pr (payment request) parameter' });
    }

    const result = await handleWithdrawCallback(k1, pr);
    return res.json(result);
  } catch (error) {
    console.error('[LNURL] Withdraw callback error:', error);
    return res.json({ 
      status: 'ERROR', 
      reason: error instanceof Error ? error.message : 'Internal error' 
    });
  }
});

export default router;
