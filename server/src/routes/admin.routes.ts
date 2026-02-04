import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { generateToken } from '../services/auth.service';
import { pointsService } from '../services/points.service';

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

// ============================================
// POINTS MANAGEMENT (Admin only)
// ============================================

// POST /api/admin/points/award - Award points to a user
router.post('/points/award', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, seasonId, points, reason } = req.body;
    const adminId = req.user!.userId;

    if (!userId || !seasonId || points === undefined || !reason) {
      return res.status(400).json({ error: 'userId, seasonId, points, and reason are required' });
    }

    if (typeof points !== 'number') {
      return res.status(400).json({ error: 'points must be a number' });
    }

    if (!reason.trim()) {
      return res.status(400).json({ error: 'reason cannot be empty' });
    }

    const result = await pointsService.adjustPoints({
      userId,
      seasonId,
      points,
      reason: reason.trim(),
      createdById: adminId,
    });

    res.json({ 
      message: `${points > 0 ? 'Awarded' : 'Deducted'} ${Math.abs(points)} points`,
      historyRecord: result 
    });
  } catch (error) {
    console.error('Error awarding points:', error);
    res.status(500).json({ error: 'Failed to award points' });
  }
});

// GET /api/admin/points/users - Get users for points management (sorted by last login)
router.get('/points/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await pointsService.getUsersForPointsManagement();
    res.json(data);
  } catch (error) {
    console.error('Error fetching users for points:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/points/history/:userId - Get points history for a user
router.get('/points/history/:userId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { seasonId } = req.query;
    
    const history = await pointsService.getUserPointsHistory(
      userId, 
      seasonId as string | undefined
    );
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching points history:', error);
    res.status(500).json({ error: 'Failed to fetch points history' });
  }
});

// GET /api/admin/users/:id/details - Get detailed user info for admin
router.get('/users/:id/details', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await pointsService.getUserAdminDetails(id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

// PUT /api/admin/users/:id/notes - Update admin notes for a user
router.put('/users/:id/notes', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    
    const result = await pointsService.updateAdminNotes(id, notes || '');
    res.json(result);
  } catch (error) {
    console.error('Error updating admin notes:', error);
    res.status(500).json({ error: 'Failed to update admin notes' });
  }
});

// POST /api/admin/run-migration - Run pending database migrations (one-time setup)
router.post('/run-migration', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Check if points_history table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'points_history'
      );
    ` as any[];
    
    if (tableExists[0]?.exists) {
      return res.json({ message: 'Migration already applied - points_history table exists', alreadyApplied: true });
    }

    // Run the migration SQL directly
    await prisma.$executeRaw`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
    `;
    await prisma.$executeRaw`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
    `;
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "points_history" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "seasonId" TEXT NOT NULL,
        "points" INTEGER NOT NULL,
        "reason" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdById" TEXT,
        CONSTRAINT "points_history_pkey" PRIMARY KEY ("id")
      );
    `;
    await prisma.$executeRaw`
      ALTER TABLE "points_history" DROP CONSTRAINT IF EXISTS "points_history_userId_fkey";
    `;
    await prisma.$executeRaw`
      ALTER TABLE "points_history" ADD CONSTRAINT "points_history_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;
    await prisma.$executeRaw`
      ALTER TABLE "points_history" DROP CONSTRAINT IF EXISTS "points_history_seasonId_fkey";
    `;
    await prisma.$executeRaw`
      ALTER TABLE "points_history" ADD CONSTRAINT "points_history_seasonId_fkey" 
      FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "points_history_userId_idx" ON "points_history"("userId");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "points_history_seasonId_idx" ON "points_history"("seasonId");
    `;
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "points_history_createdAt_idx" ON "points_history"("createdAt");
    `;

    res.json({ message: 'Migration applied successfully! Points history feature is now enabled.', success: true });
  } catch (error: any) {
    console.error('Error running migration:', error);
    res.status(500).json({ error: `Migration failed: ${error.message}` });
  }
});

// GET /api/admin/migration-status - Check if points migration has been applied
router.get('/migration-status', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'points_history'
      );
    ` as any[];
    
    res.json({ 
      pointsHistoryEnabled: tableExists[0]?.exists || false 
    });
  } catch (error) {
    console.error('Error checking migration status:', error);
    res.status(500).json({ error: 'Failed to check migration status' });
  }
});

export default router;
