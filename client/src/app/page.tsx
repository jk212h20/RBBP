'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, seasonsAPI } from '@/lib/api';
import { calculatePossiblePoints } from '@/lib/points';

interface UpcomingEvent {
  id: string;
  name: string;
  dateTime: string;
  imageUrl?: string | null;
  venue: { name: string; address?: string };
  _count: { signups: number };
  maxPlayers: number;
}

interface TopPlayer {
  user: { id: string; name: string };
  totalPoints: number;
  wins: number;
}

// Format countdown string from now until event time
function formatCountdown(dateString: string): string {
  const now = new Date().getTime();
  const eventTime = new Date(dateString).getTime();
  const diff = eventTime - now;

  if (diff <= 0) return 'Starting now!';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [, setTick] = useState(0);

  // Tick every 60s to update countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #3d7a94, #5595b0, #2a5f78)' }}>
      <MobileNav currentPage="home" />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-16">
          <Image
            src="/logo.png"
            alt="RBBP Logo"
            width={300}
            height={300}
            className="flex-shrink-0"
            priority
          />
          <div className="text-center md:text-left">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
              Welcome to Roatan Bitcoin Bar Poker
            </h1>
            <p className="text-xl md:text-2xl text-white/80 max-w-2xl">
              Play in free tournaments, win real bitcoin
            </p>
          </div>
        </div>

        {/* Upcoming Events & Top Players */}
        <div className="grid lg:grid-cols-2 gap-8 mb-16">
          {/* Upcoming Events */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">📅 Upcoming Events</h2>
              <Link href="/events" className="text-blue-300 hover:text-blue-200 text-sm">
                View All →
              </Link>
            </div>
            {loadingData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
              </div>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-white/60 text-center py-8">No upcoming events</p>
            ) : (
              <div className="space-y-4">
                {upcomingEvents.map((event) => {
                  const possiblePoints = calculatePossiblePoints(event._count.signups);
                  return (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="block bg-white/5 rounded-xl hover:bg-white/10 transition overflow-hidden"
                    >
                      {/* Thumbnail image if exists */}
                      {event.imageUrl && (
                        <div className="w-full h-32 relative">
                          <Image
                            src={event.imageUrl}
                            alt={event.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex justify-between items-start">
                          <h3 className="text-white font-semibold text-lg">{event.name}</h3>
                          {/* Countdown badge */}
                          <span className="bg-blue-600/30 text-blue-200 text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap ml-2">
                            ⏱ {formatCountdown(event.dateTime)}
                          </span>
                        </div>

                        {/* Venue name & address */}
                        <p className="text-white/60 text-sm mt-1">📍 {event.venue.name}</p>
                        {event.venue.address && (
                          <p className="text-white/40 text-xs ml-5">{event.venue.address}</p>
                        )}

                        {/* Date */}
                        <p className="text-blue-300 text-sm mt-2">{formatDate(event.dateTime)}</p>

                        {/* Players & Points row */}
                        <div className="flex justify-between items-center mt-3">
                          {/* Player count - larger font */}
                          <span className="text-white font-bold text-xl">
                            👥 {event._count.signups}/{event.maxPlayers}
                          </span>
                          {/* Treasure chest with possible points */}
                          <span className="flex items-center gap-1 bg-yellow-600/20 text-yellow-300 font-bold text-sm px-3 py-1 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                              <path d="M3 13h18v7a1 1 0 01-1 1H4a1 1 0 01-1-1v-7zm0-2V8a3 3 0 013-3h2V3h2v2h4V3h2v2h2a3 3 0 013 3v3H3zm9 4a1 1 0 00-1 1v2h2v-2a1 1 0 00-1-1z"/>
                            </svg>
                            {possiblePoints} pts
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top Players */}
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">🏆 Top Players</h2>
              <Link href="/leaderboard" className="text-blue-300 hover:text-blue-200 text-sm">
                Full Standings →
              </Link>
            </div>
            {loadingData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
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
                      <span className="text-blue-300 font-bold">{player.totalPoints} pts</span>
                      {player.wins > 0 && (
                        <span className="text-yellow-400 text-sm ml-2">({player.wins} {player.wins === 1 ? 'win' : 'wins'})</span>
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
            <p className="text-white/70 mb-6">Join Roatan Bitcoin Bar Poker today and start competing!</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition"
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
            © 2026 Roatan Bitcoin Bar Poker. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
