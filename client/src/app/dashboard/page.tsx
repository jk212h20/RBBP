'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
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

export default function DashboardPage() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [seasonStanding, setSeasonStanding] = useState<SeasonStanding | null>(null);
  const [loadingStanding, setLoadingStanding] = useState(true);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-black">
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

  const getAuthBadge = () => {
    switch (user.authProvider) {
      case 'GOOGLE':
        return '🔵 Google';
      case 'LIGHTNING':
        return '⚡ Lightning';
      default:
        return '✉️ Email';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black">
      {/* Navigation */}
      <nav className="bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🃏</span>
              <span className="text-white font-bold text-xl">RBBP</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-white/70">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-white/70 hover:text-white transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 mb-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user.name}! 🎉
              </h1>
              <p className="text-gray-600">
                Logged in with {getAuthBadge()}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm text-gray-500 mb-1">Role</h3>
              <p className="text-lg font-semibold text-gray-900">{user.role}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm text-gray-500 mb-1">Email</h3>
              <p className="text-lg font-semibold text-gray-900">
                {user.email || 'Not set'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm text-gray-500 mb-1">User ID</h3>
              <p className="text-sm font-mono text-gray-600">{user.id.slice(0, 12)}...</p>
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
                <p className="text-3xl font-bold text-green-400">
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
            💡 First 5 signups earn +2 points, others earn +1. Late cancellations and no-shows result in point penalties.
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
