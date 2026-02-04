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

// GET /api/admin/users - Get all users with their current season points (admin only)
router.get('/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Get active season
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
      select: { id: true }
    });

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        authProvider: true,
        standings: activeSeason ? {
          where: { seasonId: activeSeason.id },
          select: {
            totalPoints: true,
            rank: true,
            eventsPlayed: true
          }
        } : false
      },
      orderBy: { createdAt: 'desc' }
    });

    // Flatten standings data for easier frontend consumption
    const usersWithPoints = users.map(user => ({
      ...user,
      seasonPoints: user.standings?.[0]?.totalPoints || 0,
      seasonRank: user.standings?.[0]?.rank || null,
      eventsPlayed: user.standings?.[0]?.eventsPlayed || 0,
      standings: undefined // Remove the nested array
    }));

    res.json(usersWithPoints);
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

// DELETE /api/admin/users/:id - Permanently delete a deactivated user (admin only)
// Creates a backup in deleted_users table before deletion
router.delete('/users/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.userId;

    // Prevent admin from deleting themselves
    if (id === adminId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Find the user to delete
    const userToDelete = await prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
        standings: true,
        results: true,
        eventSignups: true,
        withdrawals: true
      }
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Only allow deletion of deactivated accounts (safety check)
    if (userToDelete.isActive) {
      return res.status(400).json({ 
        error: 'Cannot delete active accounts. Deactivate the account first.' 
      });
    }

    // Create backup in deleted_users table
    await prisma.deletedUser.create({
      data: {
        originalId: userToDelete.id,
        userData: {
          id: userToDelete.id,
          email: userToDelete.email,
          name: userToDelete.name,
          role: userToDelete.role,
          authProvider: userToDelete.authProvider,
          googleId: userToDelete.googleId,
          lightningPubkey: userToDelete.lightningPubkey,
          lightningBalanceSats: userToDelete.lightningBalanceSats,
          createdAt: userToDelete.createdAt,
          profile: userToDelete.profile,
          standingsCount: userToDelete.standings.length,
          resultsCount: userToDelete.results.length,
          eventSignupsCount: userToDelete.eventSignups.length,
          withdrawalsCount: userToDelete.withdrawals.length
        },
        deletedBy: adminId,
        reason: req.body.reason || null
      }
    });

    // Delete the user (cascades to related records due to onDelete: Cascade)
    await prisma.user.delete({
      where: { id }
    });

    res.json({ 
      message: `User ${userToDelete.name} has been permanently deleted. A backup has been created.`,
      deletedUser: {
        id: userToDelete.id,
        name: userToDelete.name,
        email: userToDelete.email
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/deleted-users - Get list of deleted users (admin only)
router.get('/deleted-users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const deletedUsers = await prisma.deletedUser.findMany({
      orderBy: { deletedAt: 'desc' },
      take: 100
    });

    res.json(deletedUsers);
  } catch (error) {
    console.error('Error fetching deleted users:', error);
    res.status(500).json({ error: 'Failed to fetch deleted users' });
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
