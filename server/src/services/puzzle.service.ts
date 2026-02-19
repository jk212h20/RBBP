import prisma from '../lib/prisma';

// ============================================
// DAILY PUZZLE SERVICE
// ============================================

// Get today's puzzle for a user (hides correctIndex until they've answered)
export async function getTodaysPuzzle(userId: string) {
  const today = getDateOnly(new Date());

  const puzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: today },
    include: {
      attempts: {
        where: { userId },
        take: 1,
      },
    },
  });

  if (!puzzle || !puzzle.isActive) {
    return { puzzle: null, attempt: null, streak: 0, yesterdayAvailable: false };
  }

  const attempt = puzzle.attempts[0] || null;
  const streak = await getStreak(userId);
  const yesterdayAvailable = await isYesterdayAvailable(userId);

  return {
    puzzle: {
      id: puzzle.id,
      date: puzzle.date,
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

  const puzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: yesterday },
    include: {
      attempts: {
        where: { userId },
        take: 1,
      },
    },
  });

  if (!puzzle || !puzzle.isActive) {
    return { puzzle: null, attempt: null };
  }

  const attempt = puzzle.attempts[0] || null;

  return {
    puzzle: {
      id: puzzle.id,
      date: puzzle.date,
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
  if (!puzzle || !puzzle.isActive) {
    throw new Error('Puzzle not found or inactive.');
  }

  // Validate date: must be today's or yesterday's puzzle
  const today = getDateOnly(new Date());
  const yesterday = getDateOnly(new Date(Date.now() - 86400000));
  const puzzleDate = getDateOnly(new Date(puzzle.date));

  if (puzzleDate.getTime() !== today.getTime() && puzzleDate.getTime() !== yesterday.getTime()) {
    throw new Error('This puzzle is no longer available.');
  }

  if (isYesterdayAttempt && puzzleDate.getTime() !== yesterday.getTime()) {
    throw new Error('This is not yesterday\'s puzzle.');
  }

  // If trying yesterday's puzzle, check they haven't done today's yet
  if (isYesterdayAttempt) {
    const todayPuzzle = await prisma.dailyPuzzle.findUnique({ where: { date: today } });
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
      // Credit sats to user's lightning balance immediately
      await prisma.user.update({
        where: { id: userId },
        data: { lightningBalanceSats: { increment: satsAwarded } },
      });
    } else {
      // Mark as pending — sats tracked but not credited until user attends an event
      isPending = true;
    }
  }

  const attempt = await prisma.puzzleAttempt.create({
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
      isYesterdayAttempt: false, // Only count today's puzzles for streak
    },
    include: { puzzle: { select: { date: true } } },
    orderBy: { puzzle: { date: 'desc' } },
  });

  if (attempts.length === 0) return 0;

  let streak = 0;
  let expectedDate = getDateOnly(new Date());

  // If they haven't done today's puzzle yet, start from yesterday
  const latestAttemptDate = getDateOnly(new Date(attempts[0].puzzle.date));
  if (latestAttemptDate.getTime() !== expectedDate.getTime()) {
    const yesterday = getDateOnly(new Date(Date.now() - 86400000));
    if (latestAttemptDate.getTime() === yesterday.getTime()) {
      expectedDate = yesterday;
    } else {
      return 0; // Gap of more than 1 day
    }
  }

  for (const attempt of attempts) {
    const attemptDate = getDateOnly(new Date(attempt.puzzle.date));
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
  // If the current streak already includes today (shouldn't happen since we call before insert), return as is
  // Otherwise add 1 for today's correct answer
  return currentStreak + 1;
}

// Check if yesterday's catch-up puzzle is available
async function isYesterdayAvailable(userId: string): Promise<boolean> {
  const yesterday = getDateOnly(new Date(Date.now() - 86400000));
  const today = getDateOnly(new Date());

  // Check yesterday's puzzle exists
  const yesterdayPuzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: yesterday },
  });
  if (!yesterdayPuzzle || !yesterdayPuzzle.isActive) return false;

  // Check they haven't answered yesterday's puzzle
  const yesterdayAttempt = await prisma.puzzleAttempt.findUnique({
    where: {
      puzzleId_userId: { puzzleId: yesterdayPuzzle.id, userId },
    },
  });
  if (yesterdayAttempt) return false;

  // Check they haven't done today's puzzle yet
  const todayPuzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: today },
  });
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
    orderBy: { date: 'desc' },
    include: {
      _count: { select: { attempts: true } },
    },
  });
}

export async function createPuzzle(data: {
  date: string;
  scenario: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  rewardSats?: number;
  imageUrl?: string;
}) {
  return prisma.dailyPuzzle.create({
    data: {
      date: new Date(data.date),
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
    date: string;
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
  const updateData: any = { ...data };
  if (data.date) updateData.date = new Date(data.date);
  return prisma.dailyPuzzle.update({
    where: { id },
    data: updateData,
  });
}

export async function deletePuzzle(id: string) {
  return prisma.dailyPuzzle.delete({ where: { id } });
}

export async function getPuzzleStats() {
  const totalPuzzles = await prisma.dailyPuzzle.count();
  const totalAttempts = await prisma.puzzleAttempt.count();
  const correctAttempts = await prisma.puzzleAttempt.count({ where: { isCorrect: true } });
  const totalSatsAwarded = await prisma.puzzleAttempt.aggregate({
    _sum: { satsAwarded: true },
  });

  return {
    totalPuzzles,
    totalAttempts,
    correctAttempts,
    accuracy: totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0,
    totalSatsAwarded: totalSatsAwarded._sum.satsAwarded || 0,
  };
}

// ============================================
// PENDING SATS FUNCTIONS
// ============================================

// Get total pending (unreleased) sats for a user
export async function getPendingSats(userId: string): Promise<number> {
  const result = await prisma.puzzleAttempt.aggregate({
    where: {
      userId,
      satsPending: true,
    },
    _sum: { satsAwarded: true },
  });
  return result._sum.satsAwarded || 0;
}

// Release all pending sats — credit them to user's lightning balance
// Called when user becomes eligible (attends their first event)
export async function releasePendingSats(userId: string): Promise<number> {
  const pendingSats = await getPendingSats(userId);
  if (pendingSats <= 0) return 0;

  // Credit balance and clear pending flags in a transaction
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
