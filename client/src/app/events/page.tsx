'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, seasonsAPI } from '@/lib/api';

interface Event {
  id: string;
  name: string;
  description?: string;
  dateTime: string;
  maxPlayers: number;
  buyIn?: number;
  status: string;
  venue: {
    id: string;
    name: string;
  };
  season: {
    id: string;
    name: string;
  };
  _count: {
    signups: number;
  };
  signups?: {
    userId: string;
  }[];
}

interface Season {
  id: string;
  name: string;
  isActive: boolean;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [selectedSeason]);

  const loadSeasons = async () => {
    try {
      const data = await seasonsAPI.getAll();
      setSeasons(data);
      // Select active season by default
      const activeSeason = data.find((s: Season) => s.isActive);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
      }
    } catch (err) {
      console.error('Failed to load seasons:', err);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const filters = selectedSeason ? { seasonId: selectedSeason } : { upcoming: true };
      const data = await eventsAPI.getAll(filters);
      setEvents(data);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (eventId: string) => {
    if (!isAuthenticated) {
      window.location.href = '/login';
      return;
    }

    try {
      await eventsAPI.signup(eventId);
      loadEvents(); // Refresh
    } catch (err: any) {
      alert(err.message || 'Failed to sign up');
    }
  };

  const handleCancelSignup = async (eventId: string) => {
    try {
      await eventsAPI.cancelSignup(eventId);
      loadEvents(); // Refresh
    } catch (err: any) {
      alert(err.message || 'Failed to cancel signup');
    }
  };

  const isUserSignedUp = (event: Event): boolean => {
    if (!user || !event.signups) return false;
    return event.signups.some(signup => signup.userId === user.id);
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      SCHEDULED: 'bg-blue-100 text-blue-800',
      REGISTRATION_OPEN: 'bg-green-100 text-green-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black">
      <MobileNav currentPage="events" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🃏 Poker Events</h1>
          <p className="text-green-200">Find and register for upcoming tournaments</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="bg-white/10 text-white border border-green-600/50 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Upcoming Events</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id} className="text-black">
                {season.name} {season.isActive && '(Current)'}
              </option>
            ))}
          </select>
        </div>

        {/* Events Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto"></div>
            <p className="text-green-200 mt-4">Loading events...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl">
            <p className="text-green-200 text-lg">No events found</p>
            <p className="text-green-300/60 mt-2">Check back later for upcoming tournaments</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 overflow-hidden hover:border-green-500/50 transition"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(event.status)}`}>
                      {event.status.replace('_', ' ')}
                    </span>
                    {event.buyIn && (
                      <span className="text-yellow-400 font-bold">${event.buyIn}</span>
                    )}
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-2">{event.name}</h3>
                  
                  <div className="space-y-2 text-sm text-green-200">
                    <p className="flex items-center gap-2">
                      📅 {formatDate(event.dateTime)}
                    </p>
                    <p className="flex items-center gap-2">
                      📍 {event.venue.name}
                    </p>
                    <p className="flex items-center gap-2">
                      👥 {event._count.signups} / {event.maxPlayers} players
                    </p>
                  </div>

                  {event.description && (
                    <p className="mt-3 text-green-300/70 text-sm line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <Link
                      href={`/events/${event.id}`}
                      className="flex-1 text-center bg-green-600/20 text-green-400 py-2 rounded-lg hover:bg-green-600/30 transition"
                    >
                      View Details
                    </Link>
                    {(event.status === 'SCHEDULED' || event.status === 'REGISTRATION_OPEN') && (
                      isUserSignedUp(event) ? (
                        <button
                          onClick={() => handleCancelSignup(event.id)}
                          className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition"
                        >
                          Unregister
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSignup(event.id)}
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition"
                        >
                          Sign Up
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
