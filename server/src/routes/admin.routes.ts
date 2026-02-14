import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { generateToken, generateClaimToken } from '../services/auth.service';
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

// POST /api/admin/merge-guest - Merge a guest user's data into a real user account
router.post('/merge-guest', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { guestUserId, realUserId } = req.body;

    if (!guestUserId || !realUserId) {
      return res.status(400).json({ error: 'guestUserId and realUserId are required' });
    }

    if (guestUserId === realUserId) {
      return res.status(400).json({ error: 'Cannot merge a user into themselves' });
    }

    // Verify guest user exists and is actually a guest
    const guestUser = await prisma.user.findUnique({
      where: { id: guestUserId },
      include: {
        eventSignups: true,
        results: true,
        standings: true,
      }
    });

    if (!guestUser) {
      return res.status(404).json({ error: 'Guest user not found' });
    }

    if (!guestUser.isGuest) {
      return res.status(400).json({ error: 'Source user is not a guest account' });
    }

    // Verify real user exists
    const realUser = await prisma.user.findUnique({ where: { id: realUserId } });
    if (!realUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Transfer all data in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Transfer event signups (skip if real user already signed up for same event)
      for (const signup of guestUser.eventSignups) {
        const existingSignup = await tx.eventSignup.findUnique({
          where: { eventId_userId: { eventId: signup.eventId, userId: realUserId } }
        });
        if (existingSignup) {
          // Real user already signed up — delete the guest's signup
          await tx.eventSignup.delete({ where: { id: signup.id } });
        } else {
          await tx.eventSignup.update({
            where: { id: signup.id },
            data: { userId: realUserId }
          });
        }
      }

      // 2. Transfer results (skip if real user already has result for same event)
      for (const result of guestUser.results) {
        const existingResult = await tx.result.findFirst({
          where: { eventId: result.eventId, userId: realUserId }
        });
        if (existingResult) {
          await tx.result.delete({ where: { id: result.id } });
        } else {
          await tx.result.update({
            where: { id: result.id },
            data: { userId: realUserId }
          });
        }
      }

      // 3. Merge standings (combine points if both have standings for same season)
      for (const standing of guestUser.standings) {
        const existingStanding = await tx.standing.findUnique({
          where: { seasonId_userId: { seasonId: standing.seasonId, userId: realUserId } }
        });
        if (existingStanding) {
          // Merge: add guest's points/stats to real user's standing
          await tx.standing.update({
            where: { id: existingStanding.id },
            data: {
              totalPoints: existingStanding.totalPoints + standing.totalPoints,
              eventsPlayed: existingStanding.eventsPlayed + standing.eventsPlayed,
              wins: existingStanding.wins + standing.wins,
              topThrees: existingStanding.topThrees + standing.topThrees,
              knockouts: existingStanding.knockouts + standing.knockouts,
            }
          });
          await tx.standing.delete({ where: { id: standing.id } });
        } else {
          await tx.standing.update({
            where: { id: standing.id },
            data: { userId: realUserId }
          });
        }
      }

      // 4. Transfer points history
      await tx.pointsHistory.updateMany({
        where: { userId: guestUserId },
        data: { userId: realUserId }
      });

      // 5. Transfer withdrawals
      await tx.withdrawal.updateMany({
        where: { userId: guestUserId },
        data: { userId: realUserId }
      });

      // 6. Delete the guest user (profile cascades)
      await tx.user.delete({ where: { id: guestUserId } });
    });

    // Recalculate ranks for all seasons the guest had standings in
    const affectedSeasonIds = guestUser.standings.map(s => s.seasonId);
    for (const seasonId of affectedSeasonIds) {
      const allStandings = await prisma.standing.findMany({
        where: { seasonId },
        orderBy: { totalPoints: 'desc' }
      });
      for (let i = 0; i < allStandings.length; i++) {
        await prisma.standing.update({
          where: { id: allStandings[i].id },
          data: { rank: i + 1 }
        });
      }
    }

    res.json({
      message: `Guest "${guestUser.name}" merged into "${realUser.name}". ${guestUser.results.length} results, ${guestUser.standings.length} standings, and ${guestUser.eventSignups.length} signups transferred.`,
      mergedData: {
        results: guestUser.results.length,
        standings: guestUser.standings.length,
        signups: guestUser.eventSignups.length,
      }
    });
  } catch (error) {
    console.error('Error merging guest:', error);
    res.status(500).json({ error: 'Failed to merge guest user' });
  }
});

// GET /api/admin/guest-users - Get all guest users for merge UI
router.get('/guest-users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const guests = await prisma.user.findMany({
      where: { isGuest: true },
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            results: true,
            eventSignups: true,
            standings: true,
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(guests);
  } catch (error) {
    console.error('Error fetching guest users:', error);
    res.status(500).json({ error: 'Failed to fetch guest users' });
  }
});

// POST /api/admin/generate-claim-link - Generate a claim link for a guest user
router.post('/generate-claim-link', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { guestUserId } = req.body;

    if (!guestUserId) {
      return res.status(400).json({ error: 'guestUserId is required' });
    }

    const result = await generateClaimToken(guestUserId);
    
    // Build the claim URL using the client URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const claimUrl = `${clientUrl}/claim/${result.token}`;

    res.json({
      claimUrl,
      guestName: result.guestName,
      expiresAt: result.expiresAt,
      message: `Claim link generated for ${result.guestName}. Share this link with the player.`
    });
  } catch (error: any) {
    console.error('Error generating claim link:', error);
    res.status(400).json({ error: error.message || 'Failed to generate claim link' });
  }
});

// ============================================
// CSV EXPORT ENDPOINTS
// ============================================

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: any[][]): string {
  const headerLine = headers.map(escapeCsv).join(',');
  const dataLines = rows.map(row => row.map(escapeCsv).join(','));
  return [headerLine, ...dataLines].join('\n');
}

// GET /api/admin/export/users - Export all users as CSV
router.get('/export/users', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
    const users = await prisma.user.findMany({
      include: {
        standings: activeSeason ? { where: { seasonId: activeSeason.id } } : false,
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Name', 'Email', 'Role', 'Auth Provider', 'Active', 'Guest', 'Season Points', 'Season Rank', 'Events Played', 'Joined'];
    const rows = users.map(u => [
      u.name,
      u.email || '',
      u.role,
      u.authProvider,
      u.isActive ? 'Yes' : 'No',
      u.isGuest ? 'Yes' : 'No',
      u.standings?.[0]?.totalPoints ?? 0,
      u.standings?.[0]?.rank ?? '',
      u.standings?.[0]?.eventsPlayed ?? 0,
      new Date(u.createdAt).toISOString().split('T')[0],
    ]);

    const csv = toCsv(headers, rows);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="users-${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).json({ error: 'Failed to export users' });
  }
});

// GET /api/admin/export/events - Export all events as CSV
router.get('/export/events', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const events = await prisma.event.findMany({
      include: {
        venue: { select: { name: true } },
        season: { select: { name: true } },
        _count: { select: { signups: true, results: true } },
      },
      orderBy: { dateTime: 'desc' },
    });

    const headers = ['Name', 'Date', 'Venue', 'Season', 'Status', 'Signups', 'Results', 'Max Players', 'Buy-In'];
    const rows = events.map(e => [
      e.name,
      new Date(e.dateTime).toISOString().replace('T', ' ').substring(0, 16),
      e.venue.name,
      e.season.name,
      e.status,
      e._count.signups,
      e._count.results,
      e.maxPlayers,
      e.buyIn ?? 0,
    ]);

    const csv = toCsv(headers, rows);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="events-${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting events:', error);
    res.status(500).json({ error: 'Failed to export events' });
  }
});

// GET /api/admin/export/standings - Export current season standings as CSV
router.get('/export/standings', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const activeSeason = await prisma.season.findFirst({ where: { isActive: true } });
    if (!activeSeason) {
      return res.status(404).json({ error: 'No active season' });
    }

    const standings = await prisma.standing.findMany({
      where: { seasonId: activeSeason.id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { rank: 'asc' },
    });

    const headers = ['Rank', 'Name', 'Email', 'Total Points', 'Events Played', 'Wins', 'Top 3s', 'Knockouts'];
    const rows = standings.map(s => [
      s.rank,
      s.user.name,
      s.user.email || '',
      s.totalPoints,
      s.eventsPlayed,
      s.wins,
      s.topThrees,
      s.knockouts,
    ]);

    const csv = toCsv(headers, rows);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="standings-${activeSeason.name.replace(/\s+/g, '-')}-${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting standings:', error);
    res.status(500).json({ error: 'Failed to export standings' });
  }
});

// GET /api/admin/export/results - Export all event results as CSV
router.get('/export/results', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const results = await prisma.result.findMany({
      include: {
        user: { select: { name: true, email: true } },
        event: { select: { name: true, dateTime: true } },
      },
      orderBy: [{ event: { dateTime: 'desc' } }, { position: 'asc' }],
    });

    const headers = ['Event', 'Event Date', 'Player', 'Email', 'Position', 'Knockouts', 'Points Earned'];
    const rows = results.map(r => [
      r.event.name,
      new Date(r.event.dateTime).toISOString().split('T')[0],
      r.user.name,
      r.user.email || '',
      r.position,
      r.knockouts,
      r.pointsEarned,
    ]);

    const csv = toCsv(headers, rows);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="results-${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ error: 'Failed to export results' });
  }
});

// GET /api/admin/export/signups - Export all event signups as CSV
router.get('/export/signups', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const signups = await prisma.eventSignup.findMany({
      include: {
        user: { select: { name: true, email: true } },
        event: { select: { name: true, dateTime: true } },
      },
      orderBy: [{ event: { dateTime: 'desc' } }, { registeredAt: 'asc' }],
    });

    const headers = ['Event', 'Event Date', 'Player', 'Email', 'Status', 'Registered At', 'Checked In At'];
    const rows = signups.map(s => [
      s.event.name,
      new Date(s.event.dateTime).toISOString().split('T')[0],
      s.user.name,
      s.user.email || '',
      s.status,
      new Date(s.registeredAt).toISOString().replace('T', ' ').substring(0, 16),
      s.checkedInAt ? new Date(s.checkedInAt).toISOString().replace('T', ' ').substring(0, 16) : '',
    ]);

    const csv = toCsv(headers, rows);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="signups-${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting signups:', error);
    res.status(500).json({ error: 'Failed to export signups' });
  }
});

// GET /api/admin/export/withdrawals - Export all withdrawals as CSV
router.get('/export/withdrawals', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['User', 'Email', 'Amount (sats)', 'Status', 'Created', 'Paid At', 'Expires At'];
    const rows = withdrawals.map(w => [
      w.user.name,
      w.user.email || '',
      w.amountSats,
      w.status,
      new Date(w.createdAt).toISOString().replace('T', ' ').substring(0, 16),
      w.paidAt ? new Date(w.paidAt).toISOString().replace('T', ' ').substring(0, 16) : '',
      w.expiresAt ? new Date(w.expiresAt).toISOString().replace('T', ' ').substring(0, 16) : '',
    ]);

    const csv = toCsv(headers, rows);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="withdrawals-${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting withdrawals:', error);
    res.status(500).json({ error: 'Failed to export withdrawals' });
  }
});

// GET /api/admin/export/points-history - Export points history as CSV
router.get('/export/points-history', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const history = await prisma.pointsHistory.findMany({
      include: {
        user: { select: { name: true, email: true } },
        season: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Player', 'Email', 'Season', 'Points', 'Reason', 'Date'];
    const rows = history.map(h => [
      h.user.name,
      h.user.email || '',
      h.season.name,
      h.points,
      h.reason,
      new Date(h.createdAt).toISOString().replace('T', ' ').substring(0, 16),
    ]);

    const csv = toCsv(headers, rows);
    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="points-history-${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting points history:', error);
    res.status(500).json({ error: 'Failed to export points history' });
  }
});

// POST /api/admin/apply-pending-migrations - Apply all pending schema changes directly
router.post('/apply-pending-migrations', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const results: string[] = [];

    // Migration 1: registrationCloseMinutes on events
    try {
      await prisma.$executeRaw`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registrationCloseMinutes" INTEGER NOT NULL DEFAULT 30`;
      results.push('✅ events.registrationCloseMinutes added');
    } catch (e: any) {
      results.push(`⚠️ events.registrationCloseMinutes: ${e.message}`);
    }

    // Migration 2: profileImage on profiles
    try {
      await prisma.$executeRaw`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "profileImage" TEXT`;
      results.push('✅ profiles.profileImage added');
    } catch (e: any) {
      results.push(`⚠️ profiles.profileImage: ${e.message}`);
    }

    // Migration 3: venue_applications table + enum
    try {
      await prisma.$executeRaw`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VenueApplicationStatus') THEN CREATE TYPE "VenueApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); END IF; END $$`;
      results.push('✅ VenueApplicationStatus enum created');
    } catch (e: any) {
      results.push(`⚠️ VenueApplicationStatus enum: ${e.message}`);
    }

    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS "venue_applications" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "address" TEXT NOT NULL,
          "description" TEXT,
          "imageUrl" TEXT,
          "phone" TEXT,
          "email" TEXT,
          "contactName" TEXT NOT NULL,
          "contactEmail" TEXT,
          "contactPhone" TEXT,
          "status" "VenueApplicationStatus" NOT NULL DEFAULT 'PENDING',
          "submittedById" TEXT NOT NULL,
          "reviewedById" TEXT,
          "reviewedAt" TIMESTAMP(3),
          "rejectionReason" TEXT,
          "venueId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "venue_applications_pkey" PRIMARY KEY ("id")
        )
      `;
      results.push('✅ venue_applications table created');
    } catch (e: any) {
      results.push(`⚠️ venue_applications table: ${e.message}`);
    }

    // Add foreign keys (ignore if already exist)
    try {
      await prisma.$executeRaw`ALTER TABLE "venue_applications" ADD CONSTRAINT "venue_applications_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`;
      results.push('✅ venue_applications FK submittedById added');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('⚠️ venue_applications FK submittedById already exists');
      } else {
        results.push(`⚠️ venue_applications FK submittedById: ${e.message}`);
      }
    }

    try {
      await prisma.$executeRaw`ALTER TABLE "venue_applications" ADD CONSTRAINT "venue_applications_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE`;
      results.push('✅ venue_applications FK reviewedById added');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('⚠️ venue_applications FK reviewedById already exists');
      } else {
        results.push(`⚠️ venue_applications FK reviewedById: ${e.message}`);
      }
    }

    try {
      await prisma.$executeRaw`ALTER TABLE "venue_applications" ADD CONSTRAINT "venue_applications_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE`;
      results.push('✅ venue_applications FK venueId added');
    } catch (e: any) {
      if (e.message?.includes('already exists')) {
        results.push('⚠️ venue_applications FK venueId already exists');
      } else {
        results.push(`⚠️ venue_applications FK venueId: ${e.message}`);
      }
    }

    res.json({ message: 'Pending migrations applied', results });
  } catch (error: any) {
    console.error('Error applying migrations:', error);
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
