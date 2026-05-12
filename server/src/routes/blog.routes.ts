import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Convert a title into a URL-safe slug. Falls back to a random suffix if empty.
function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  return base || `post-${Date.now().toString(36)}`;
}

async function uniqueSlug(desired: string, ignoreId?: string): Promise<string> {
  const base = slugify(desired);
  let candidate = base;
  let suffix = 2;
  // Loop until unique. In practice this resolves in 1-2 iterations.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.blogPost.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

// GET /api/blog — public: published posts (newest first), list view (no full content)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        publishedAt: true,
      },
    });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// GET /api/blog/all — admin: every post
router.get('/all', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const posts = await prisma.blogPost.findMany({
      orderBy: { publishedAt: 'desc' },
    });
    res.json(posts);
  } catch (error) {
    console.error('Error fetching all blog posts:', error);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// GET /api/blog/:slug — public: one published post by slug
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const post = await prisma.blogPost.findUnique({ where: { slug } });
    if (!post || !post.isPublished) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    res.json(post);
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
});

// POST /api/blog — admin: create
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, excerpt, content, coverImage, isPublished, slug } = req.body;
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' });
      return;
    }
    const finalSlug = await uniqueSlug(slug || title);
    const post = await prisma.blogPost.create({
      data: {
        slug: finalSlug,
        title,
        excerpt: excerpt || null,
        content,
        coverImage: coverImage || null,
        isPublished: isPublished ?? true,
      },
    });
    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
});

// PUT /api/blog/:id — admin: update
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, coverImage, isPublished, slug } = req.body;

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    // Only recompute slug if caller explicitly sent a (different) one.
    let nextSlug: string | undefined;
    if (slug !== undefined && slug !== existing.slug) {
      nextSlug = await uniqueSlug(slug, id);
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(excerpt !== undefined && { excerpt: excerpt || null }),
        ...(content !== undefined && { content }),
        ...(coverImage !== undefined && { coverImage: coverImage || null }),
        ...(isPublished !== undefined && { isPublished }),
        ...(nextSlug && { slug: nextSlug }),
      },
    });
    res.json(post);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    console.error('Error updating blog post:', error);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

// DELETE /api/blog/:id — admin
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.blogPost.delete({ where: { id } });
    res.json({ message: 'Post deleted' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

export default router;
