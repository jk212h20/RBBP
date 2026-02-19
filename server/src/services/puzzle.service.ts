import prisma from '../lib/prisma';

// ============================================
// DAILY PUZZLE SERVICE (Queue-based)
// ============================================

// Get today's puzzle for a user
// Logic: find puzzle with usedAt = today. If none, pop next from queue (lowest sortOrder with usedAt null)
export async function getTodaysPuzzle(userId: string) {
  const today = getDateOnly(new Date());

  // Try to find puzzle already assigned to today
  let puzzle = await prisma.dailyPuzzle.findFirst({
    where: { usedAt: today, isActive: true },
    include: {
      attempts: {
        where: { userId },
        take: 1,
      },
    },
  });

  // If no puzzle for today, pop next from queue
  if (!puzzle) {
    const nextInQueue = await prisma.dailyPuzzle.findFirst({
      where: { usedAt: null, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    if (nextInQueue) {
      // Assign it to today
      puzzle = await prisma.dailyPuzzle.update({
        where: { id: nextInQueue.id },
        data: { usedAt: today },
        include: {
          attempts: {
            where: { userId },
            take: 1,
          },
        },
      });
    }
  }

  if (!puzzle) {
    return { puzzle: null, attempt: null, streak: 0, yesterdayAvailable: false };
  }

  const attempt = puzzle.attempts[0] || null;
  const streak = await getStreak(userId);
  const yesterdayAvailable = await isYesterdayAvailable(userId);

  return {
    puzzle: {
      id: puzzle.id,
      scenario: puzzle.scenario,
      question: puzzle.question,
      options: puzzle.options,
      rewardSats: puzzle.rewardSats,
      imageUrl: puzzle.imageUrl,
      // Only reveal correct answer + explanation after they've answered
      ...(attempt
        ? { correctIndex: puzzle.correctIndex, explanation: puzzle.explanation }
        : {}),
    },
    attempt: attempt
      ? {
          selectedIndex: attempt.selectedIndex,
          isCorrect: attempt.isCorrect,
          satsAwarded: attempt.satsAwarded,
        }
      : null,
    streak,
    yesterdayAvailable,
  };
}

// Get yesterday's puzzle for catch-up
export async function getYesterdaysPuzzle(userId: string) {
  const yesterday = getDateOnly(new Date(Date.now() - 86400000));

  const puzzle = await prisma.dailyPuzzle.findFirst({
    where: { usedAt: yesterday, isActive: true },
    include: {
      attempts: {
        where: { userId },
        take: 1,
      },
    },
  });

  if (!puzzle) {
    return { puzzle: null, attempt: null };
  }

  const attempt = puzzle.attempts[0] || null;

  return {
    puzzle: {
      id: puzzle.id,
      scenario: puzzle.scenario,
      question: puzzle.question,
      options: puzzle.options,
      rewardSats: Math.floor(puzzle.rewardSats / 2), // Half reward for yesterday
      imageUrl: puzzle.imageUrl,
      ...(attempt
        ? { correctIndex: puzzle.correctIndex, explanation: puzzle.explanation }
        : {}),
    },
    attempt: attempt
      ? {
          selectedIndex: attempt.selectedIndex,
          isCorrect: attempt.isCorrect,
          satsAwarded: attempt.satsAwarded,
        }
      : null,
  };
}

// Submit an answer
export async function submitAnswer(
  userId: string,
  puzzleId: string,
  selectedIndex: number,
  isYesterdayAttempt: boolean = false
) {
  // Check if already answered
  const existing = await prisma.puzzleAttempt.findUnique({
    where: {
      puzzleId_userId: { puzzleId, userId },
    },
  });
  if (existing) {
    throw new Error('You have already answered this puzzle.');
  }

  // Get puzzle
  const puzzle = await prisma.dailyPuzzle.findUnique({ where: { id: puzzleId } });
  if (!puzzle || !puzzle.isActive || !puzzle.usedAt) {
    throw new Error('Puzzle not found or not yet active.');
  }

  // Validate: must be today's or yesterday's puzzle
  const today = getDateOnly(new Date());
  const yesterday = getDateOnly(new Date(Date.now() - 86400000));
  const puzzleUsedAt = getDateOnly(new Date(puzzle.usedAt));

  if (puzzleUsedAt.getTime() !== today.getTime() && puzzleUsedAt.getTime() !== yesterday.getTime()) {
    throw new Error('This puzzle is no longer available.');
  }

  if (isYesterdayAttempt && puzzleUsedAt.getTime() !== yesterday.getTime()) {
    throw new Error('This is not yesterday\'s puzzle.');
  }

  // If trying yesterday's puzzle, check they haven't done today's yet
  if (isYesterdayAttempt) {
    const todayPuzzle = await prisma.dailyPuzzle.findFirst({ where: { usedAt: today } });
    if (todayPuzzle) {
      const todayAttempt = await prisma.puzzleAttempt.findUnique({
        where: { puzzleId_userId: { puzzleId: todayPuzzle.id, userId } },
      });
      if (todayAttempt) {
        throw new Error('Yesterday\'s catch-up puzzle is no longer available after completing today\'s puzzle.');
      }
    }
  }

  // Check eligibility (has attended at least 1 event)
  const eligible = await isEligible(userId);

  const isCorrect = selectedIndex === puzzle.correctIndex;
  let satsAwarded = 0;
  let isPending = false;

  if (isCorrect) {
    const baseReward = isYesterdayAttempt
      ? Math.floor(puzzle.rewardSats / 2)
      : puzzle.rewardSats;
    satsAwarded = baseReward;

    // Check for 7-day streak bonus (only on today's puzzle)
    if (!isYesterdayAttempt) {
      const streakAfter = await getStreakIfCorrect(userId);
      if (streakAfter > 0 && streakAfter % 7 === 0) {
        satsAwarded += 1000; // Weekly streak bonus
      }
    }

    if (eligible) {
      await prisma.user.update({
        where: { id: userId },
        data: { lightningBalanceSats: { increment: satsAwarded } },
      });
    } else {
      isPending = true;
    }
  }

  await prisma.puzzleAttempt.create({
    data: {
      puzzleId,
      userId,
      selectedIndex,
      isCorrect,
      satsAwarded,
      satsPending: isPending,
      isYesterdayAttempt,
    },
  });

  return {
    isCorrect,
    satsAwarded,
    satsPending: isPending,
    correctIndex: puzzle.correctIndex,
    explanation: puzzle.explanation,
    streakBonus: satsAwarded > (isYesterdayAttempt ? Math.floor(puzzle.rewardSats / 2) : puzzle.rewardSats) ? 1000 : 0,
  };
}

// Check if user is eligible (has attended at least 1 event)
export async function isEligible(userId: string): Promise<boolean> {
  const resultCount = await prisma.result.count({
    where: { userId },
  });
  return resultCount > 0;
}

// Get current streak (consecutive days with correct answers)
export async function getStreak(userId: string): Promise<number> {
  const attempts = await prisma.puzzleAttempt.findMany({
    where: {
      userId,
      isCorrect: true,
      isYesterdayAttempt: false,
    },
    include: { puzzle: { select: { usedAt: true } } },
    orderBy: { puzzle: { usedAt: 'desc' } },
  });

  if (attempts.length === 0) return 0;

  let streak = 0;
  let expectedDate = getDateOnly(new Date());

  // If they haven't done today's puzzle yet, start from yesterday
  const latestDate = attempts[0].puzzle.usedAt ? getDateOnly(new Date(attempts[0].puzzle.usedAt)) : null;
  if (!latestDate) return 0;

  if (latestDate.getTime() !== expectedDate.getTime()) {
    const yesterday = getDateOnly(new Date(Date.now() - 86400000));
    if (latestDate.getTime() === yesterday.getTime()) {
      expectedDate = yesterday;
    } else {
      return 0;
    }
  }

  for (const attempt of attempts) {
    const attemptDate = attempt.puzzle.usedAt ? getDateOnly(new Date(attempt.puzzle.usedAt)) : null;
    if (!attemptDate) break;
    if (attemptDate.getTime() === expectedDate.getTime()) {
      streak++;
      expectedDate = getDateOnly(new Date(expectedDate.getTime() - 86400000));
    } else {
      break;
    }
  }

  return streak;
}

// Calculate what streak would be if they answer correctly today
async function getStreakIfCorrect(userId: string): Promise<number> {
  const currentStreak = await getStreak(userId);
  return currentStreak + 1;
}

// Check if yesterday's catch-up puzzle is available
async function isYesterdayAvailable(userId: string): Promise<boolean> {
  const yesterday = getDateOnly(new Date(Date.now() - 86400000));
  const today = getDateOnly(new Date());

  const yesterdayPuzzle = await prisma.dailyPuzzle.findFirst({
    where: { usedAt: yesterday, isActive: true },
  });
  if (!yesterdayPuzzle) return false;

  const yesterdayAttempt = await prisma.puzzleAttempt.findUnique({
    where: {
      puzzleId_userId: { puzzleId: yesterdayPuzzle.id, userId },
    },
  });
  if (yesterdayAttempt) return false;

  const todayPuzzle = await prisma.dailyPuzzle.findFirst({ where: { usedAt: today } });
  if (todayPuzzle) {
    const todayAttempt = await prisma.puzzleAttempt.findUnique({
      where: {
        puzzleId_userId: { puzzleId: todayPuzzle.id, userId },
      },
    });
    if (todayAttempt) return false;
  }

  return true;
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

export async function getAllPuzzles() {
  return prisma.dailyPuzzle.findMany({
    orderBy: [
      { usedAt: 'desc' },   // Used puzzles first (most recent)
      { sortOrder: 'asc' }, // Then queued puzzles by sort order
    ],
    include: {
      _count: { select: { attempts: true } },
    },
  });
}

export async function createPuzzle(data: {
  scenario: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  rewardSats?: number;
  imageUrl?: string;
}) {
  // Auto-assign next sortOrder (put at end of queue)
  const maxOrder = await prisma.dailyPuzzle.aggregate({
    _max: { sortOrder: true },
  });
  const nextOrder = (maxOrder._max.sortOrder ?? 0) + 1;

  return prisma.dailyPuzzle.create({
    data: {
      sortOrder: nextOrder,
      scenario: data.scenario,
      question: data.question,
      options: data.options,
      correctIndex: data.correctIndex,
      explanation: data.explanation,
      rewardSats: data.rewardSats ?? 500,
      imageUrl: data.imageUrl || null,
    },
  });
}

export async function updatePuzzle(
  id: string,
  data: Partial<{
    scenario: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    rewardSats: number;
    imageUrl: string | null;
    isActive: boolean;
  }>
) {
  return prisma.dailyPuzzle.update({
    where: { id },
    data,
  });
}

// Reorder queued (unused) puzzles
export async function reorderPuzzles(orderedIds: string[]) {
  // Only reorder puzzles that haven't been used yet
  const updates = orderedIds.map((id, index) =>
    prisma.dailyPuzzle.updateMany({
      where: { id, usedAt: null },
      data: { sortOrder: index + 1 },
    })
  );
  await prisma.$transaction(updates);
  return { reordered: orderedIds.length };
}

export async function deletePuzzle(id: string) {
  // Only allow deleting unused puzzles (or puzzles with no attempts)
  const puzzle = await prisma.dailyPuzzle.findUnique({
    where: { id },
    include: { _count: { select: { attempts: true } } },
  });
  if (puzzle && puzzle._count.attempts > 0) {
    throw new Error('Cannot delete a puzzle that has been attempted. Deactivate it instead.');
  }
  return prisma.dailyPuzzle.delete({ where: { id } });
}

export async function getPuzzleStats() {
  const totalPuzzles = await prisma.dailyPuzzle.count();
  const usedPuzzles = await prisma.dailyPuzzle.count({ where: { usedAt: { not: null } } });
  const queuedPuzzles = await prisma.dailyPuzzle.count({ where: { usedAt: null, isActive: true } });
  const totalAttempts = await prisma.puzzleAttempt.count();
  const correctAttempts = await prisma.puzzleAttempt.count({ where: { isCorrect: true } });
  const totalSatsAwarded = await prisma.puzzleAttempt.aggregate({
    _sum: { satsAwarded: true },
  });

  return {
    totalPuzzles,
    usedPuzzles,
    queuedPuzzles,
    totalAttempts,
    correctAttempts,
    accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
    totalSatsAwarded: totalSatsAwarded._sum.satsAwarded || 0,
  };
}

// ============================================
// PENDING SATS FUNCTIONS
// ============================================

export async function getPendingSats(userId: string): Promise<number> {
  const result = await prisma.puzzleAttempt.aggregate({
    where: { userId, satsPending: true },
    _sum: { satsAwarded: true },
  });
  return result._sum.satsAwarded || 0;
}

export async function releasePendingSats(userId: string): Promise<number> {
  const pendingSats = await getPendingSats(userId);
  if (pendingSats <= 0) return 0;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { lightningBalanceSats: { increment: pendingSats } },
    }),
    prisma.puzzleAttempt.updateMany({
      where: { userId, satsPending: true },
      data: { satsPending: false },
    }),
  ]);

  return pendingSats;
}

// ============================================
// HELPERS
// ============================================

function getDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
