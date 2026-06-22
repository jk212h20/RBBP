'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, seasonsAPI, blogAPI, sideBetsAPI, type BlogListItem } from '@/lib/api';
import { calculatePossiblePoints } from '@/lib/points';

interface UpcomingEvent {
  id: string;
  slug?: string;
  name: string;
  dateTime: string;
  imageUrl?: string | null;
  venue: { name: string; address?: string };
  _count: { signups: number };
  maxPlayers: number;
  lastLongerEnabled?: boolean;
}

interface TopPlayer {
  user: { id: string; name: string };
  totalPoints: number;
  wins: number;
}

interface ActiveSideBet {
  id: string;
  label: string;
  creator?: { id: string; name: string } | null;
  event?: { id: string; name: string; slug?: string | null; dateTime?: string } | null;
  entrySats: number;
  entryCount: number;
  totalPot: number;
  createdAt: string;
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
  const [latestPosts, setLatestPosts] = useState<BlogListItem[]>([]);
  const [activeSideBets, setActiveSideBets] = useState<ActiveSideBet[]>([]);
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

      // Load latest blog posts (top 3). Fail quiet — blog is optional.
      try {
        const posts = await blogAPI.list();
        setLatestPosts(posts.slice(0, 3));
      } catch (err) {
        // ignore
      }

      // Load all active side bets. Fail quiet — side bets should not block the home page.
      try {
        const bets = await sideBetsAPI.listOpen();
        setActiveSideBets(bets);
      } catch (err) {
        setActiveSideBets([]);
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
    <div className="min-h-screen page-gradient-home">
      <MobileNav currentPage="home" />

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-16">
          {/* Shark/logo — mobile shrinks to ~40% of desktop size (120px vs 300px). */}
          <Image
            src="/logo.png"
            alt="RBBP Logo"
            width={300}
            height={300}
            className="flex-shrink-0 w-[120px] h-[120px] md:w-[300px] md:h-[300px]"
            priority
          />
          <div className="text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold text-white mb-3">
              Welcome to Roatan Bitcoin Bar Poker
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-2xl">
              Play in free tournaments, win real bitcoin
            </p>

            {/* Above-the-fold call to action (only for logged-out visitors) */}
            {!isAuthenticated && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition text-base"
                >
                  Join Free
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center bg-white/10 hover:bg-white/20 border border-white/30 text-white font-semibold px-6 py-3 rounded-lg transition text-base"
                >
                  Sign In
                </Link>
              </div>
            )}
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
                      href={`/events/${event.slug || event.id}`}
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
                          <div>
                            <h3 className="text-white font-semibold text-lg">{event.name}</h3>
                          </div>
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
                            {/* Player count */}
                            <span className="text-white font-bold text-base flex items-center gap-1">
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

        {/* Latest Blog Posts */}
        {latestPosts.length > 0 && (
          <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/10 mb-16">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-white">📝 Latest Posts</h2>
              <Link href="/blog" className="text-blue-300 hover:text-blue-200 text-sm">
                View All →
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {latestPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="block bg-white/5 rounded-xl hover:bg-white/10 transition overflow-hidden"
                >
                  {post.coverImage && (
                    <div className="relative w-full h-32">
                      <Image src={post.coverImage} alt={post.title} fill className="object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-white/50 text-xs mb-1">
                      {new Date(post.publishedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                    <h3 className="text-white font-semibold text-base mb-1 line-clamp-2">{post.title}</h3>
                    {post.excerpt && (
                      <p className="text-white/60 text-sm line-clamp-2">{post.excerpt}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Side Bets */}
        <div className="mb-8">
          <div className="max-w-3xl mx-auto bg-white/10 backdrop-blur rounded-2xl p-5 border border-white/10">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-white">🎲 Event Side Bets</h2>
              <p className="text-white/50 text-sm mt-1">Shown here starting 15 minutes before the event. Event pages always show their side bet.</p>
            </div>

            {loadingData ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-400 mx-auto"></div>
              </div>
            ) : activeSideBets.length === 0 ? (
              <p className="text-white/60 text-center py-4">No event side bets are within 15 minutes of starting.</p>
            ) : (
              <div className="space-y-3">
                {activeSideBets.map((bet) => (
                  <Link
                    key={bet.id}
                    href={`/bets/${bet.id}`}
                    className="block bg-white/5 rounded-xl hover:bg-white/10 transition p-4 border border-white/5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <h3 className="text-white font-semibold text-lg">{bet.label}</h3>
                        <p className="text-white/50 text-sm">
                          {bet.event ? bet.event.name : `Created by ${bet.creator?.name || 'Unknown'}`}
                        </p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <p className="text-yellow-300 font-bold">⚡ {bet.totalPot.toLocaleString()} pot</p>
                        <p className="text-white/50 text-sm">{bet.entrySats.toLocaleString()} sats entry</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3 text-xs">
                      <span className="bg-blue-500/20 text-blue-200 px-2 py-1 rounded-full">
                        {bet.entryCount} {bet.entryCount === 1 ? 'entry' : 'entries'}
                      </span>
                      {bet.event && (
                        <span className="bg-purple-500/20 text-purple-200 px-2 py-1 rounded-full">
                          Event side bet
                        </span>
                      )}
                      {bet.event?.dateTime && (
                        <span className="bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded-full">
                          Starts {formatCountdown(bet.event.dateTime)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        {!isAuthenticated && (
          <div className="text-center bg-white/5 backdrop-blur rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold text-white mb-6">Start Playing!</h3>
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
