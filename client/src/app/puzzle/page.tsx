'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { puzzleAPI } from '@/lib/api';
import MobileNav from '@/components/MobileNav';
import Link from 'next/link';

export default function PuzzlePage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [puzzle, setPuzzle] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [streak, setStreak] = useState(0);
  const [yesterdayAvailable, setYesterdayAvailable] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showYesterday, setShowYesterday] = useState(false);
  const [yesterdayPuzzle, setYesterdayPuzzle] = useState<any>(null);
  const [yesterdayAttempt, setYesterdayAttempt] = useState<any>(null);
  const [yesterdaySelectedIndex, setYesterdaySelectedIndex] = useState<number | null>(null);
  const [yesterdayResult, setYesterdayResult] = useState<any>(null);
  const [eligible, setEligible] = useState(true);
  const [pendingSats, setPendingSats] = useState(0);
  const [satsReleased, setSatsReleased] = useState(0);

  const loadPuzzle = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await puzzleAPI.getToday();
      setPuzzle(data.puzzle);
      setAttempt(data.attempt);
      setStreak(data.streak);
      setYesterdayAvailable(data.yesterdayAvailable);
      setEligible(data.eligible ?? true);
      setPendingSats(data.pendingSats ?? 0);
      setSatsReleased(data.satsReleased ?? 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load puzzle');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadPuzzle();
    }
  }, [isAuthenticated, authLoading, loadPuzzle]);

  const handleSubmit = async () => {
    if (selectedIndex === null || !puzzle) return;
    setSubmitting(true);
    try {
      const res = await puzzleAPI.submitAnswer({
        puzzleId: puzzle.id,
        selectedIndex,
        isYesterdayAttempt: false,
      });
      setResult(res);
      setAttempt({
        selectedIndex,
        isCorrect: res.isCorrect,
        satsAwarded: res.satsAwarded,
      });
      // Update puzzle with revealed answer
      setPuzzle((prev: any) => ({
        ...prev,
        correctIndex: res.correctIndex,
        explanation: res.explanation,
      }));
      if (res.isCorrect) {
        setStreak((s) => s + 1);
        if (res.satsPending) {
          setPendingSats((p) => p + res.satsAwarded);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const loadYesterday = async () => {
    try {
      const data = await puzzleAPI.getYesterday();
      setYesterdayPuzzle(data.puzzle);
      setYesterdayAttempt(data.attempt);
      setShowYesterday(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load yesterday\'s puzzle');
    }
  };

  const handleYesterdaySubmit = async () => {
    if (yesterdaySelectedIndex === null || !yesterdayPuzzle) return;
    setSubmitting(true);
    try {
      const res = await puzzleAPI.submitAnswer({
        puzzleId: yesterdayPuzzle.id,
        selectedIndex: yesterdaySelectedIndex,
        isYesterdayAttempt: true,
      });
      setYesterdayResult(res);
      setYesterdayAttempt({
        selectedIndex: yesterdaySelectedIndex,
        isCorrect: res.isCorrect,
        satsAwarded: res.satsAwarded,
      });
      setYesterdayPuzzle((prev: any) => ({
        ...prev,
        correctIndex: res.correctIndex,
        explanation: res.explanation,
      }));
      setYesterdayAvailable(false);
      if (res.isCorrect && res.satsPending) {
        setPendingSats((p) => p + res.satsAwarded);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <MobileNav currentPage="puzzle" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-white/60 text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <MobileNav currentPage="puzzle" />
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="text-6xl mb-4">🧩</div>
          <h1 className="text-3xl font-bold text-white mb-4">Daily Poker Puzzle</h1>
          <p className="text-white/70 mb-6">
            Solve a daily poker puzzle and earn <span className="text-yellow-400 font-bold">500 sats</span> for each correct answer!
          </p>
          <p className="text-white/50 mb-8">Sign in to play.</p>
          <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium">
            Sign In to Play
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <MobileNav currentPage="puzzle" />
      
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">🧩 Daily Poker Puzzle</h1>
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="text-yellow-400">⚡ 500 sats for correct answers</span>
            {streak > 0 && (
              <span className="text-orange-400">🔥 {streak} day streak</span>
            )}
          </div>
          {streak > 0 && streak % 7 === 0 && (
            <div className="mt-2 text-green-400 text-sm font-medium">
              🎉 Weekly streak bonus: +1,000 sats every 7 days!
            </div>
          )}
        </div>

        {/* Sats Released Banner — shows when user just became eligible */}
        {satsReleased > 0 && (
          <div className="mb-6 bg-green-900/40 border border-green-500/40 rounded-xl p-4 text-center">
            <div className="text-3xl mb-2">🎉⚡</div>
            <p className="text-green-300 font-bold text-lg">
              Welcome to the league! {satsReleased.toLocaleString()} pending sats have been credited to your balance!
            </p>
            <p className="text-green-400/70 text-sm mt-1">
              Your puzzle rewards are now paid out immediately.
            </p>
          </div>
        )}

        {/* Pending Sats Banner — shows for non-eligible users */}
        {!eligible && (
          <div className="mb-6 bg-yellow-900/30 border border-yellow-600/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <p className="text-yellow-300 font-medium">
                  Your sats are saved but pending!
                </p>
                <p className="text-yellow-200/60 text-sm mt-1">
                  Attend your first poker event to unlock{' '}
                  {pendingSats > 0 && (
                    <span className="text-yellow-400 font-bold">{pendingSats.toLocaleString()} pending sats</span>
                  )}
                  {pendingSats > 0 ? ' and ' : ''}all future puzzle rewards. Keep playing daily to build your streak — every correct answer is tracked!
                </p>
                <Link href="/events" className="inline-block mt-2 text-blue-400 hover:text-blue-300 text-sm underline">
                  View Upcoming Events →
                </Link>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-white/60">Loading puzzle...</div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400 mb-4">{error}</div>
            <button onClick={loadPuzzle} className="text-blue-400 hover:underline">Try Again</button>
          </div>
        ) : !puzzle ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📅</div>
            <p className="text-white/70 text-lg">No puzzle available today.</p>
            <p className="text-white/50 mt-2">Check back tomorrow!</p>
          </div>
        ) : (
          <>
            {/* Today's Puzzle */}
            <PuzzleCard
              puzzle={puzzle}
              attempt={attempt}
              selectedIndex={selectedIndex}
              onSelect={setSelectedIndex}
              onSubmit={handleSubmit}
              submitting={submitting}
              result={result}
              label="Today's Puzzle"
              eligible={eligible}
            />

            {/* Yesterday's Catch-up */}
            {yesterdayAvailable && !showYesterday && !attempt && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadYesterday}
                  className="text-blue-400 hover:text-blue-300 transition text-sm underline"
                >
                  Missed yesterday? Try it for half reward (250 sats)
                </button>
              </div>
            )}

            {showYesterday && yesterdayPuzzle && (
              <div className="mt-8">
                <PuzzleCard
                  puzzle={yesterdayPuzzle}
                  attempt={yesterdayAttempt}
                  selectedIndex={yesterdaySelectedIndex}
                  onSelect={setYesterdaySelectedIndex}
                  onSubmit={handleYesterdaySubmit}
                  submitting={submitting}
                  result={yesterdayResult}
                  label="Yesterday's Puzzle (Half Reward)"
                  eligible={eligible}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// PUZZLE CARD COMPONENT
// ============================================
function PuzzleCard({
  puzzle,
  attempt,
  selectedIndex,
  onSelect,
  onSubmit,
  submitting,
  result,
  label,
  eligible,
}: {
  puzzle: any;
  attempt: any;
  selectedIndex: number | null;
  onSelect: (idx: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  result: any;
  label: string;
  eligible: boolean;
}) {
  const answered = !!attempt;
  const options = puzzle.options as string[];

  return (
    <div className="bg-white/5 backdrop-blur border border-blue-700/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
        <span className="text-yellow-400 text-sm font-medium">⚡ {puzzle.rewardSats} sats</span>
      </div>

      {/* Scenario */}
      <div className="bg-blue-900/30 border border-blue-700/20 rounded-lg p-4 mb-4">
        <p className="text-white/90 text-sm leading-relaxed">{puzzle.scenario}</p>
      </div>

      {/* Question */}
      <h2 className="text-white font-semibold text-lg mb-4">{puzzle.question}</h2>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {options.map((option: string, idx: number) => {
          let btnClass = 'w-full text-left px-4 py-3 rounded-lg border transition text-sm ';

          if (answered) {
            if (idx === puzzle.correctIndex) {
              btnClass += 'bg-green-900/40 border-green-500 text-green-300';
            } else if (idx === attempt.selectedIndex && !attempt.isCorrect) {
              btnClass += 'bg-red-900/40 border-red-500 text-red-300';
            } else {
              btnClass += 'bg-white/5 border-white/10 text-white/40';
            }
          } else if (idx === selectedIndex) {
            btnClass += 'bg-blue-900/50 border-blue-400 text-blue-200';
          } else {
            btnClass += 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20';
          }

          const letter = String.fromCharCode(65 + idx); // A, B, C, D, E

          return (
            <button
              key={idx}
              onClick={() => !answered && onSelect(idx)}
              disabled={answered}
              className={btnClass}
            >
              <span className="font-medium mr-2">{letter}.</span>
              {option}
            </button>
          );
        })}
      </div>

      {/* Submit Button */}
      {!answered && (
        <button
          onClick={onSubmit}
          disabled={selectedIndex === null || submitting}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Lock In Answer'}
        </button>
      )}

      {/* Result */}
      {answered && (
        <div className={`rounded-lg p-4 ${attempt.isCorrect ? 'bg-green-900/30 border border-green-700/30' : 'bg-red-900/30 border border-red-700/30'}`}>
          <div className="flex items-center gap-2 mb-2">
            {attempt.isCorrect ? (
              <>
                <span className="text-2xl">✅</span>
                <span className="text-green-400 font-bold text-lg">Correct!</span>
                <span className="text-yellow-400 ml-auto font-medium">
                  {eligible ? '+' : ''}{attempt.satsAwarded} sats {eligible ? '⚡' : '⏳'}
                </span>
              </>
            ) : (
              <>
                <span className="text-2xl">❌</span>
                <span className="text-red-400 font-bold text-lg">Incorrect</span>
              </>
            )}
          </div>
          {attempt.isCorrect && !eligible && (
            <div className="text-yellow-400/80 text-sm mb-2">
              ⏳ {attempt.satsAwarded} sats saved — attend an event to unlock!
            </div>
          )}
          {result?.streakBonus > 0 && (
            <div className="text-green-400 text-sm mb-2">
              🎉 7-day streak bonus: +{result.streakBonus} sats!
            </div>
          )}
          {puzzle.explanation && (
            <p className="text-white/70 text-sm leading-relaxed mt-2">
              {puzzle.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
