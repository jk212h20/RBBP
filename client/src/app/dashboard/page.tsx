'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const { user, logout, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

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
              <span className="text-white font-bold text-xl">Roatan Poker</span>
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

        {/* Quick Actions */}
        <h2 className="text-white text-xl font-bold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition cursor-pointer">
            <div className="text-3xl mb-2">🏆</div>
            <h3 className="text-white font-semibold">Leaderboard</h3>
            <p className="text-white/60 text-sm">View current standings</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition cursor-pointer">
            <div className="text-3xl mb-2">📅</div>
            <h3 className="text-white font-semibold">Events</h3>
            <p className="text-white/60 text-sm">Browse upcoming games</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition cursor-pointer">
            <div className="text-3xl mb-2">📍</div>
            <h3 className="text-white font-semibold">Venues</h3>
            <p className="text-white/60 text-sm">Find poker nights</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition cursor-pointer">
            <div className="text-3xl mb-2">👤</div>
            <h3 className="text-white font-semibold">Profile</h3>
            <p className="text-white/60 text-sm">Edit your details</p>
          </div>
        </div>

        {/* Auth Success Message */}
        <div className="mt-8 bg-green-500/20 backdrop-blur border border-green-400/30 rounded-xl p-6">
          <h3 className="text-green-300 font-semibold mb-2">✅ Authentication Working!</h3>
          <p className="text-white/80">
            You successfully logged in using <strong>{getAuthBadge()}</strong>. 
            The multi-provider authentication system is fully functional.
          </p>
        </div>
      </main>
    </div>
  );
}
