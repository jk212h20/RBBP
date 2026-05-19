import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import {
  createStoreLightningCheckout,
  createStoreOrder,
  ensureDefaultStore,
  getAdminStore,
  getMyStoreOrders,
  getStorefront,
  getStoreOrderStatus,
  previewPromoCode,
  updateStoreProduct,
  updateStorePromoCode,
  updateStoreVariant,
} from '../services/store.service';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const products = await getStorefront();
    res.json({ products });
  } catch (error) {
    console.error('[Store] Get storefront error:', error);
    res.status(500).json({ error: 'Failed to load store' });
  }
});

router.post('/promo/preview', authenticate, async (req: Request, res: Response) => {
  try {
    const { productId, promoCode } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required' });

    const promo = await previewPromoCode(productId, promoCode);
    res.json({ promo });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to apply promo code' });
  }
});

router.get('/orders/my', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const orders = await getMyStoreOrders(userId);
    res.json({ orders });
  } catch (error) {
    console.error('[Store] Get my orders error:', error);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.post('/checkout/lightning', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { productId, variantId, promoCode } = req.body;
    if (!productId || !variantId) {
      return res.status(400).json({ error: 'Choose an item and size' });
    }

    const result = await createStoreLightningCheckout(userId, { productId, variantId, promoCode });
    res.status(201).json(result);
  } catch (error) {
    console.error('[Store] Create lightning checkout error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create Lightning checkout' });
  }
});

router.get('/orders/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const order = await getStoreOrderStatus(userId, req.params.id);
    res.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get order status';
    const status = message === 'Order not found' ? 404 : message === 'Not authorized' ? 403 : 400;
    res.status(status).json({ error: message });
  }
});

router.post('/orders', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { productId, variantId, promoCode } = req.body;
    if (!productId || !variantId) {
      return res.status(400).json({ error: 'Choose an item and size' });
    }

    const result = await createStoreOrder(userId, { productId, variantId, promoCode });
    res.status(201).json(result);
  } catch (error) {
    console.error('[Store] Create order error:', error);
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to create order' });
  }
});

router.get('/admin', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const store = await getAdminStore();
    res.json(store);
  } catch (error) {
    console.error('[Store] Admin load error:', error);
    res.status(500).json({ error: 'Failed to load admin store' });
  }
});

router.post('/admin/ensure-defaults', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await ensureDefaultStore();
    res.json({ message: 'Default store is ready' });
  } catch (error) {
    console.error('[Store] Ensure defaults error:', error);
    res.status(500).json({ error: 'Failed to ensure default store' });
  }
});

router.put('/admin/products/:productId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const product = await updateStoreProduct(req.params.productId, req.body);
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update item' });
  }
});

router.put('/admin/variants/:variantId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const variant = await updateStoreVariant(req.params.variantId, req.body);
    res.json(variant);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update size' });
  }
});

router.put('/admin/promo-codes/:promoId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const promo = await updateStorePromoCode(req.params.promoId, req.body);
    res.json(promo);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to update promo code' });
  }
});

export default router;
