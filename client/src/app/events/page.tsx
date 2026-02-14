'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, seasonsAPI } from '@/lib/api';
import { calculatePossiblePoints } from '@/lib/points';

interface Event {
  id: string;
  name: string;
  description?: string;
  dateTime: string;
  imageUrl?: string;
  maxPlayers: number;
  buyIn?: number;
  status: string;
  venue: {
    id: string;
    name: string;
    address?: string;
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

/** Format a countdown string from now until the target date */
function formatCountdown(targetDate: Date): string {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) return 'Starting now';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [, setTick] = useState(0); // for countdown re-renders
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [selectedSeason]);

  // Tick every 60s to update countdowns
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

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
    if (!isAuthenticated || !user) {
      window.location.href = '/login';
      return;
    }

    // Optimistic update - add user to signups immediately
    const previousEvents = events;
    setEvents(prev => prev.map(e => 
      e.id === eventId 
        ? { 
            ...e, 
            signups: [...(e.signups || []), { userId: user.id }],
            _count: { ...e._count, signups: e._count.signups + 1 }
          } 
        : e
    ));

    try {
      await eventsAPI.signup(eventId);
    } catch (err: any) {
      // Restore on error
      setEvents(previousEvents);
      alert(err.message || 'Failed to sign up');
    }
  };

  const handleCancelSignup = async (eventId: string) => {
    if (!user) return;
    
    // Optimistic update - remove user from signups immediately
    const previousEvents = events;
    setEvents(prev => prev.map(e => 
      e.id === eventId 
        ? { 
            ...e, 
            signups: (e.signups || []).filter(s => s.userId !== user.id),
            _count: { ...e._count, signups: Math.max(0, e._count.signups - 1) }
          } 
        : e
    ));

    try {
      await eventsAPI.cancelSignup(eventId);
    } catch (err: any) {
      // Restore on error
      setEvents(previousEvents);
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
      REGISTRATION_OPEN: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-gray-100 text-gray-800',
      CANCELLED: 'bg-red-100 text-red-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const isUpcoming = (event: Event) => new Date(event.dateTime) > new Date();

  return (
    <div className="min-h-screen ">
      <MobileNav currentPage="events" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🃏 Poker Events</h1>
          <p className="text-blue-100">Find and register for upcoming tournaments</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="bg-white/10 text-white border border-blue-600/50 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-blue-100 mt-4">Loading events...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl">
            <p className="text-blue-100 text-lg">No events found</p>
            <p className="text-blue-200/60 mt-2">Check back later for upcoming tournaments</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const signupCount = event._count.signups;
              const possiblePoints = calculatePossiblePoints(signupCount);
              const eventDate = new Date(event.dateTime);
              const upcoming = isUpcoming(event);

              return (
                <div
                  key={event.id}
                  className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 overflow-hidden hover:border-blue-500/50 transition"
                >
                  {/* Thumbnail image */}
                  {event.imageUrl && (
                    <div className="w-full h-40 overflow-hidden">
                      <img
                        src={event.imageUrl}
                        alt={event.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="p-6">
                    {/* Status badge + buy-in row */}
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(event.status)}`}>
                        {event.status.replace('_', ' ')}
                      </span>
                      {event.buyIn && (
                        <span className="text-yellow-400 font-bold">${event.buyIn}</span>
                      )}
                    </div>
                    
                    {/* Event name */}
                    <h3 className="text-xl font-bold text-white mb-2">{event.name}</h3>
                    
                    {/* Event info */}
                    <div className="space-y-2 text-sm text-blue-100">
                      <p className="flex items-center gap-2">
                        📅 {formatDate(event.dateTime)}
                      </p>
                      <p className="flex items-center gap-2">
                        📍 {event.venue.name}
                        {event.venue.address && (
                          <span className="text-blue-200/60">— {event.venue.address}</span>
                        )}
                      </p>

                      {/* Countdown */}
                      {upcoming && (
                        <p className="flex items-center gap-2 text-yellow-300">
                          ⏱️ {formatCountdown(eventDate)}
                        </p>
                      )}
                    </div>

                    {/* Player count (large) + Points row */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">👥</span>
                        <span className="text-2xl font-bold text-white">
                          {signupCount} / {event.maxPlayers}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-yellow-500/20 px-3 py-1.5 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-300">
                          <path d="M3 13h18v7a1 1 0 01-1 1H4a1 1 0 01-1-1v-7zm0-2V8a3 3 0 013-3h2V3h2v2h4V3h2v2h2a3 3 0 013 3v3H3zm9 4a1 1 0 00-1 1v2h2v-2a1 1 0 00-1-1z"/>
                        </svg>
                        <span className="text-yellow-300 font-bold text-sm">{possiblePoints} pts</span>
                      </div>
                    </div>

                    {event.description && (
                      <p className="mt-3 text-blue-200/70 text-sm line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="mt-4 flex gap-2">
                      <Link
                        href={`/events/${event.id}`}
                        className="flex-1 text-center bg-blue-600/20 text-blue-300 py-2 rounded-lg hover:bg-blue-600/30 transition"
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
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                          >
                            Sign Up
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
