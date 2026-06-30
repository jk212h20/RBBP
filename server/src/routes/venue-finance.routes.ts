import { Router, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate, requireAdmin, requireRole } from '../middleware/auth.middleware';
import {
  cancelVenueInvoice,
  checkVenueInvoicePayment,
  createVenueInvoice,
  getVenueInvoiceForUser,
  listAdminVenueInvoices,
  listMyVenueInvoices,
  regenerateVenueInvoice,
} from '../services/venue-finance.service';

const router = Router();

router.get('/admin/invoices', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const invoices = await listAdminVenueInvoices({
      status: req.query.status ? String(req.query.status) : undefined,
      venueId: req.query.venueId ? String(req.query.venueId) : undefined,
    });
    res.json({ invoices });
  } catch (error) {
    console.error('[VenueFinance] Admin list error:', error);
    res.status(500).json({ error: 'Failed to load venue invoices' });
  }
});

router.post('/admin/invoices', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const invoice = await createVenueInvoice(userId, req.body);
    res.status(201).json(invoice);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create venue invoice' });
  }
});

router.post('/admin/invoices/:id/check', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const invoice = await checkVenueInvoicePayment(req.params.id, userId, UserRole.ADMIN);
    res.json(invoice);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to check invoice' });
  }
});

router.post('/admin/invoices/:id/cancel', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const invoice = await cancelVenueInvoice(req.params.id, userId, 'CANCELLED');
    res.json(invoice);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to cancel invoice' });
  }
});

router.post('/admin/invoices/:id/waive', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const invoice = await cancelVenueInvoice(req.params.id, userId, 'WAIVED');
    res.json(invoice);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to waive invoice' });
  }
});

router.post('/admin/invoices/:id/regenerate', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const invoice = await regenerateVenueInvoice(req.params.id, userId);
    res.json(invoice);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to regenerate invoice' });
  }
});

router.get('/my/invoices', authenticate, requireRole(UserRole.VENUE_MANAGER, UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const invoices = req.user?.role === UserRole.ADMIN
      ? await listAdminVenueInvoices({})
      : await listMyVenueInvoices(userId);
    res.json({ invoices });
  } catch (error) {
    console.error('[VenueFinance] My invoices error:', error);
    res.status(500).json({ error: 'Failed to load venue invoices' });
  }
});

router.get('/my/invoices/:id', authenticate, requireRole(UserRole.VENUE_MANAGER, UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role as UserRole | undefined;
    if (!userId || !role) return res.status(401).json({ error: 'Not authenticated' });

    const invoice = await getVenueInvoiceForUser(req.params.id, userId, role);
    res.json(invoice);
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : 'Failed to load invoice' });
  }
});

router.post('/my/invoices/:id/check', authenticate, requireRole(UserRole.VENUE_MANAGER, UserRole.ADMIN), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role as UserRole | undefined;
    if (!userId || !role) return res.status(401).json({ error: 'Not authenticated' });

    const invoice = await checkVenueInvoicePayment(req.params.id, userId, role);
    res.json(invoice);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to check invoice' });
  }
});

export default router;
