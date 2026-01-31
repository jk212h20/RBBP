'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();

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
              {loading ? (
                <span className="text-white/50">Loading...</span>
              ) : isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-white/80 hover:text-white transition"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            🃏 Roatan Poker League
          </h1>
          <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-12">
            Track tournaments, climb the leaderboard, and join the best pub poker community in Roatan.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/register"
              className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg"
            >
              Join the League
            </Link>
            <Link
              href="/login"
              className="bg-white/10 backdrop-blur text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition border border-white/30"
            >
              Sign In
            </Link>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/10">
              <div className="text-4xl mb-4">🏆</div>
              <h3 className="text-white font-bold text-xl mb-2">Leaderboards</h3>
              <p className="text-white/70">
                Track your ranking across seasons and compete for the top spot.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/10">
              <div className="text-4xl mb-4">📅</div>
              <h3 className="text-white font-bold text-xl mb-2">Events</h3>
              <p className="text-white/70">
                Find poker nights at venues across Roatan and sign up instantly.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-8 border border-white/10">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-white font-bold text-xl mb-2">Lightning Login</h3>
              <p className="text-white/70">
                Sign in with your Bitcoin Lightning wallet - no password needed!
              </p>
            </div>
          </div>

          {/* Auth Methods */}
          <div className="mt-16 bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10 max-w-2xl mx-auto">
            <h3 className="text-white font-bold text-lg mb-4">
              Multiple ways to sign in:
            </h3>
            <div className="flex justify-center gap-8 text-white/70">
              <div className="flex items-center gap-2">
                <span>✉️</span> Email
              </div>
              <div className="flex items-center gap-2">
                <span>🔵</span> Google
              </div>
              <div className="flex items-center gap-2">
                <span>⚡</span> Lightning
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-white/50">
            © 2026 Roatan Poker League. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
