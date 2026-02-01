'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, seasonsAPI } from '@/lib/api';

interface UpcomingEvent {
  id: string;
  name: string;
  dateTime: string;
  venue: { name: string };
  _count: { signups: number };
  maxPlayers: number;
}

interface TopPlayer {
  user: { id: string; name: string };
  totalPoints: number;
  wins: number;
}

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadHomeData();
  }, []);

  const loadHomeData = async () => {
    try {
      // Load upcoming events
      const events = await eventsAPI.getUpcoming(3);
      setUpcomingEvents(events);

      // Load current season standings
      try {
        const season = await seasonsAPI.getCurrent();
        if (season) {
          const standings = await seasonsAPI.getStandings(season.id, 5);
          setTopPlayers(standings);
        }
      } catch (err) {
        // No active season, that's okay
      }
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
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
              <Link href="/events" className="text-white/80 hover:text-white transition">
                Events
              </Link>
              <Link href="/leaderboard" className="text-white/80 hover:text-white transition">
                Leaderboard
              </Link>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            🃏 Roatan Poker League
          </h1>
          <p className="text-xl md:text-2xl text-white/80 max-w-2xl mx-auto mb-8">
            Track tournaments, climb the leaderboard, and join the best pub poker community in Roatan.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/events"
              className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg"
            >
              View Events
            </Link>
            <Link
              href="/leaderboard"
              className="bg-white/10 backdrop-blur text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white/20 transition border border-white/30"
            >
              Leaderboard
            </Link>
          </div>
        </div>

        {/* Upcoming Events & Top Players */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {/* Upcoming Events */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">📅 Upcoming Events</h2>
              <Link href="/events" className="text-green-400 hover:text-green-300 text-sm">
                View All →
              </Link>
            </div>
            {loadingData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-white/60 text-center py-8">No upcoming events</p>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block p-4 bg-white/5 rounded-xl hover:bg-white/10 transition"
                  >
                    <h3 className="text-white font-semibold">{event.name}</h3>
                    <div className="flex justify-between text-sm text-white/60 mt-1">
                      <span>📍 {event.venue.name}</span>
                      <span>👥 {event._count.signups}/{event.maxPlayers}</span>
                    </div>
                    <p className="text-green-400 text-sm mt-1">{formatDate(event.dateTime)}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Top Players */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">🏆 Top Players</h2>
              <Link href="/leaderboard" className="text-green-400 hover:text-green-300 text-sm">
                Full Standings →
              </Link>
            </div>
            {loadingData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
              </div>
            ) : topPlayers.length === 0 ? (
              <p className="text-white/60 text-center py-8">No standings yet</p>
            ) : (
              <div className="space-y-3">
                {topPlayers.map((player, index) => (
                  <div
                    key={player.user.id}
                    className={`flex items-center justify-between p-3 rounded-xl ${
                      index === 0 ? 'bg-yellow-500/20' :
                      index === 1 ? 'bg-gray-400/20' :
                      index === 2 ? 'bg-orange-600/20' :
                      'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                      </span>
                      <span className="text-white font-medium">{player.user.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-green-400 font-bold">{player.totalPoints} pts</span>
                      {player.wins > 0 && (
                        <span className="text-yellow-400 text-sm ml-2">({player.wins} wins)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
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

        {/* CTA */}
        {!isAuthenticated && (
          <div className="text-center bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-4">Ready to play?</h3>
            <p className="text-white/70 mb-6">Join the Roatan Poker League today and start competing!</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition"
              >
                Create Account
              </Link>
              <Link
                href="/login"
                className="bg-white/10 text-white px-8 py-3 rounded-xl font-bold hover:bg-white/20 transition border border-white/30"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-white/50">
            © 2026 Roatan Poker League. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
