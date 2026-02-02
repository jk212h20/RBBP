import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { generateToken } from '../services/auth.service';

const router = Router();

// POST /api/admin/promote - Promote a user to admin (requires existing admin or first-time setup)
router.post('/promote', authenticate, async (req: Request, res: Response) => {
  try {
    const { email, secretKey } = req.body;
    const currentUser = req.user;

    // Check if this is the first admin setup (no admins exist)
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' }
    });

    // If no admins exist, allow first admin setup with secret key
    if (adminCount === 0) {
      const setupKey = process.env.ADMIN_SETUP_KEY || 'roatan-poker-setup-2024';
      if (secretKey !== setupKey) {
        return res.status(403).json({ error: 'Invalid setup key for first admin' });
      }
      
      // Promote the current user to admin
      const updatedUser = await prisma.user.update({
        where: { id: currentUser!.userId },
        data: { role: 'ADMIN' }
      });

      // Generate new token with updated role
      const newToken = generateToken(updatedUser);

      return res.json({ 
        message: 'You are now the first admin!',
        user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role },
        token: newToken
      });
    }

    // Otherwise, require current user to be admin
    if (currentUser?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only admins can promote users' });
    }

    // Find user to promote
    const userToPromote = await prisma.user.findUnique({
      where: { email }
    });

    if (!userToPromote) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Promote user
    const updatedUser = await prisma.user.update({
      where: { id: userToPromote.id },
      data: { role: 'ADMIN' }
    });

    res.json({ 
      message: `${email} is now an admin`,
      user: { id: updatedUser.id, email: updatedUser.email, role: updatedUser.role }
    });
  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
});

// GET /api/admin/users - Get all users (admin only)
router.get('/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        authProvider: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/role - Update user role (admin only)
router.put('/users/:id/role', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['ADMIN', 'VENUE_MANAGER', 'TOURNAMENT_DIRECTOR', 'PLAYER'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// PUT /api/admin/users/:id/status - Update user active status (admin only)
router.put('/users/:id/status', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// GET /api/admin/stats - Get admin dashboard stats
router.get('/stats', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const [userCount, venueCount, eventCount, seasonCount] = await Promise.all([
      prisma.user.count(),
      prisma.venue.count(),
      prisma.event.count(),
      prisma.season.count()
    ]);

    res.json({
      users: userCount,
      venues: venueCount,
      events: eventCount,
      seasons: seasonCount
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
