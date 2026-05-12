import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// GET /api/announcements — public: active announcements, ordered for display
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: { id: true, message: true, linkUrl: true, sortOrder: true },
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET /api/announcements/all — admin
router.get('/all', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const items = await prisma.announcement.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching all announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// POST /api/announcements — admin
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { message, linkUrl, isActive, sortOrder } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }
    const created = await prisma.announcement.create({
      data: {
        message: message.trim(),
        linkUrl: linkUrl || null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// PUT /api/announcements/:id — admin
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, linkUrl, isActive, sortOrder } = req.body;
    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(message !== undefined && { message }),
        ...(linkUrl !== undefined && { linkUrl: linkUrl || null }),
        ...(isActive !== undefined && { isActive }),
        ...(sortOrder !== undefined && { sortOrder }),
      },
    });
    res.json(updated);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// DELETE /api/announcements/:id — admin
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.announcement.delete({ where: { id } });
    res.json({ message: 'Announcement deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Announcement not found' });
      return;
    }
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

export default router;
