'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI } from '@/lib/api';

interface UserEvent {
  id: string;
  name: string;
  dateTime: string;
  venue: { name: string };
  signups: { status: string }[];
  results: { position: number; pointsEarned: number }[];
}

export default function ProfilePage() {
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [myEvents, setMyEvents] = useState<UserEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [stats, setStats] = useState({
    eventsPlayed: 0,
    totalPoints: 0,
    wins: 0,
    topThrees: 0,
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadMyEvents();
    }
  }, [isAuthenticated]);

  const loadMyEvents = async () => {
    setLoadingEvents(true);
    try {
      const events = await eventsAPI.getMy();
      setMyEvents(events);
      
      // Calculate stats from events
      let totalPoints = 0;
      let wins = 0;
      let topThrees = 0;
      
      events.forEach((event: UserEvent) => {
        if (event.results && event.results.length > 0) {
          const result = event.results[0];
          totalPoints += result.pointsEarned;
          if (result.position === 1) wins++;
          if (result.position <= 3) topThrees++;
        }
      });
      
      setStats({
        eventsPlayed: events.filter((e: UserEvent) => e.results && e.results.length > 0).length,
        totalPoints,
        wins,
        topThrees,
      });
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getAuthBadge = () => {
    if (!user) return '';
    switch (user.authProvider) {
      case 'GOOGLE':
        return '🔵 Google';
      case 'LIGHTNING':
        return '⚡ Lightning';
      default:
        return '✉️ Email';
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-green-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-white">
            🃏 Roatan Poker
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/events" className="text-white/80 hover:text-white">Events</Link>
            <Link href="/leaderboard" className="text-white/80 hover:text-white">Leaderboard</Link>
            <Link href="/dashboard" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link href="/dashboard" className="text-green-400 hover:text-green-300 mb-6 inline-block">
          ← Back to Dashboard
        </Link>

        {/* Profile Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-6 mb-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full" />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">{user.name}</h1>
              <p className="text-green-200">{user.email || 'No email set'}</p>
              <p className="text-green-300/60 text-sm mt-1">
                Logged in with {getAuthBadge()} • {user.role}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{stats.totalPoints}</p>
            <p className="text-green-200 text-sm">Total Points</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-4 text-center">
            <p className="text-3xl font-bold text-white">{stats.eventsPlayed}</p>
            <p className="text-green-200 text-sm">Events Played</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">{stats.wins}</p>
            <p className="text-green-200 text-sm">Wins</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-4 text-center">
            <p className="text-3xl font-bold text-orange-400">{stats.topThrees}</p>
            <p className="text-green-200 text-sm">Top 3 Finishes</p>
          </div>
        </div>

        {/* Event History */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4">📅 Event History</h2>
          
          {loadingEvents ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
            </div>
          ) : myEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-green-300/60">No events yet</p>
              <Link href="/events" className="text-green-400 hover:underline mt-2 inline-block">
                Browse upcoming events →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block p-4 bg-white/5 rounded-lg hover:bg-white/10 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-white font-medium">{event.name}</h3>
                      <p className="text-green-300/60 text-sm">
                        {event.venue.name} • {formatDate(event.dateTime)}
                      </p>
                    </div>
                    <div className="text-right">
                      {event.results && event.results.length > 0 ? (
                        <>
                          <p className="text-white font-bold">
                            {event.results[0].position === 1 ? '🥇' : 
                             event.results[0].position === 2 ? '🥈' : 
                             event.results[0].position === 3 ? '🥉' : 
                             `#${event.results[0].position}`}
                          </p>
                          <p className="text-green-400 text-sm">{event.results[0].pointsEarned} pts</p>
                        </>
                      ) : event.signups && event.signups.length > 0 ? (
                        <span className="text-blue-400 text-sm">Registered</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
