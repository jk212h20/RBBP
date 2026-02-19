'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import MobileNav from '@/components/MobileNav';
import { standingsAPI } from '@/lib/api';

interface SeasonStanding {
  season: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  standing: {
    totalPoints: number;
    eventsPlayed: number;
    wins: number;
    topThrees: number;
    knockouts: number;
    rank: number | null;
  } | null;
}

function DashboardContent() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [seasonStanding, setSeasonStanding] = useState<SeasonStanding | null>(null);
  const [loadingStanding, setLoadingStanding] = useState(true);
  const [showLightningBonus, setShowLightningBonus] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadSeasonStanding();
    }
  }, [isAuthenticated]);

  // Check for lightning bonus notification
  useEffect(() => {
    const lightningBonus = searchParams.get('lightningBonus');
    if (lightningBonus === 'true') {
      setShowLightningBonus(true);
      // Clear the URL parameter
      router.replace('/dashboard', { scroll: false });
      // Auto-hide after 5 seconds
      setTimeout(() => setShowLightningBonus(false), 5000);
    }
  }, [searchParams, router]);

  const loadSeasonStanding = async () => {
    try {
      const data = await standingsAPI.getMy();
      setSeasonStanding(data);
    } catch (err) {
      console.error('Failed to load season standing:', err);
    } finally {
      setLoadingStanding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Check if user needs to complete their profile
  const isLightningWithoutName = user.authProvider === 'LIGHTNING' && 
    (user.name.startsWith('Lightning User') || user.name.startsWith('Player'));
  const isEmailOnlyAccount = user.authProvider === 'EMAIL' && !user.lightningPubkey;
  const isGoogleOnlyAccount = user.authProvider === 'GOOGLE' && !user.lightningPubkey;
  const needsLightning = isEmailOnlyAccount || isGoogleOnlyAccount;

  // Format role display - only show for non-players
  const getRoleDisplay = () => {
    if (user.role === 'PLAYER') return null;
    return ` (${user.role.replace('_', ' ')})`;
  };

  return (
    <div className="min-h-screen ">
      {/* Lightning Bonus Notification */}
      {showLightningBonus && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="font-bold">Thanks for logging in with Lightning!</p>
              <p className="text-sm">+1 Point awarded to your season standings!</p>
            </div>
            <button 
              onClick={() => setShowLightningBonus(false)}
              className="ml-2 text-black/60 hover:text-black"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <MobileNav currentPage="dashboard" />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Card - Simplified */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0 overflow-hidden">
              {user.profile?.profileImage || user.avatar ? (
                <img src={(user.profile?.profileImage || user.avatar)!} alt={user.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">
                Welcome, {user.name}{getRoleDisplay()} 🎉
              </h1>
              
              {/* Profile completion prompts */}
              {isLightningWithoutName && (
                <Link href="/profile" className="text-orange-600 hover:text-orange-700 text-sm flex items-center gap-1 mt-1">
                  ⚠️ Add your name and email in Profile to complete your account
                </Link>
              )}
              {needsLightning && (
                <Link href="/profile" className="text-yellow-600 hover:text-yellow-700 text-sm flex items-center gap-1 mt-1">
                  ⚡ Link a Lightning wallet in Profile to earn 1 bonus point!
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Season Points Card */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur rounded-2xl border border-yellow-500/30 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                🏆 Season Points
              </h2>
              {seasonStanding?.season && (
                <p className="text-yellow-200/70 text-sm">{seasonStanding.season.name}</p>
              )}
            </div>
            <Link href="/leaderboard" className="text-yellow-400 hover:text-yellow-300 text-sm">
              View Leaderboard →
            </Link>
          </div>
          
          {loadingStanding ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400"></div>
            </div>
          ) : !seasonStanding?.season ? (
            <p className="text-yellow-200/60 text-center py-4">No active season</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-black/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-yellow-400">
                  {seasonStanding.standing?.totalPoints || 0}
                </p>
                <p className="text-yellow-200/70 text-sm">Points</p>
              </div>
              <div className="bg-black/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-white">
                  {seasonStanding.standing?.rank ? `#${seasonStanding.standing.rank}` : '-'}
                </p>
                <p className="text-yellow-200/70 text-sm">Rank</p>
              </div>
              <div className="bg-black/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-white">
                  {seasonStanding.standing?.eventsPlayed || 0}
                </p>
                <p className="text-yellow-200/70 text-sm">Events</p>
              </div>
              <div className="bg-black/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-blue-300">
                  {seasonStanding.standing?.wins || 0}
                </p>
                <p className="text-yellow-200/70 text-sm">Wins</p>
              </div>
              <div className="bg-black/20 rounded-lg p-4 text-center">
                <p className="text-3xl font-bold text-orange-400">
                  {seasonStanding.standing?.knockouts || 0}
                </p>
                <p className="text-yellow-200/70 text-sm">Knockouts</p>
              </div>
            </div>
          )}
          
          <p className="text-yellow-200/50 text-xs mt-4 text-center">
            💡 First 5 signups to each event earn 2 points, others earn 1. Late cancellations and no-shows result in point losses.
          </p>
        </div>

        {/* Quick Actions */}
        <h2 className="text-white text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/leaderboard" className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition">
            <div className="text-3xl mb-2">🏆</div>
            <h3 className="text-white font-semibold">Leaderboard</h3>
            <p className="text-white/60 text-sm">View current standings</p>
          </Link>
          <Link href="/events" className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition">
            <div className="text-3xl mb-2">📅</div>
            <h3 className="text-white font-semibold">Events</h3>
            <p className="text-white/60 text-sm">Browse upcoming games</p>
          </Link>
          <Link href="/venues" className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition">
            <div className="text-3xl mb-2">📍</div>
            <h3 className="text-white font-semibold">Venues</h3>
            <p className="text-white/60 text-sm">Find poker nights</p>
          </Link>
          <Link href="/profile" className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition">
            <div className="text-3xl mb-2">👤</div>
            <h3 className="text-white font-semibold">Profile</h3>
            <p className="text-white/60 text-sm">Edit your details</p>
          </Link>
        </div>

        {/* Admin Quick Access */}
        {user.role === 'ADMIN' && (
          <>
            <h2 className="text-white text-xl font-bold mb-4 mt-8">Admin</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/admin" className="bg-purple-600/20 backdrop-blur rounded-xl p-6 hover:bg-purple-600/30 transition border border-purple-500/30">
                <div className="text-3xl mb-2">👑</div>
                <h3 className="text-purple-300 font-semibold">Admin Panel</h3>
                <p className="text-purple-300/60 text-sm">Manage everything</p>
              </Link>
            </div>
          </>
        )}

      </main>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center ">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
