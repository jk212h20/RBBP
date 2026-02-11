import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// GET /api/faq - Public: get all active FAQs
router.get('/', async (req: Request, res: Response) => {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, question: true, answer: true, sortOrder: true },
    });
    res.json(faqs);
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// GET /api/faq/all - Admin: get ALL FAQs (including inactive)
router.get('/all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const faqs = await prisma.faq.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json(faqs);
  } catch (error) {
    console.error('Error fetching all FAQs:', error);
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
});

// POST /api/faq - Admin: create FAQ
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { question, answer, sortOrder, isActive } = req.body;

    if (!question || !answer) {
      res.status(400).json({ error: 'Question and answer are required' });
      return;
    }

    const faq = await prisma.faq.create({
      data: {
        question,
        answer,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    });
    res.status(201).json(faq);
  } catch (error) {
    console.error('Error creating FAQ:', error);
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
});

// PUT /api/faq/:id - Admin: update FAQ
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { question, answer, sortOrder, isActive } = req.body;

    const faq = await prisma.faq.update({
      where: { id },
      data: {
        ...(question !== undefined && { question }),
        ...(answer !== undefined && { answer }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    res.json(faq);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'FAQ not found' });
      return;
    }
    console.error('Error updating FAQ:', error);
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
});

// DELETE /api/faq/:id - Admin: delete FAQ
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.faq.delete({ where: { id } });
    res.json({ message: 'FAQ deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'FAQ not found' });
      return;
    }
    console.error('Error deleting FAQ:', error);
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

export default router;
