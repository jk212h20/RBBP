'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI } from '@/lib/api';

interface EventDetail {
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
    address: string;
    phone?: string;
  };
  season: {
    id: string;
    name: string;
  };
  director?: {
    id: string;
    name: string;
  };
  signups: {
    id: string;
    status: string;
    registeredAt: string;
    user: {
      id: string;
      name: string;
      avatar?: string;
    };
  }[];
  results: {
    id: string;
    position: number;
    knockouts: number;
    pointsEarned: number;
    user: {
      id: string;
      name: string;
      avatar?: string;
    };
  }[];
  _count: {
    signups: number;
    results: number;
    comments: number;
  };
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSignedUp, setIsSignedUp] = useState(false);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    if (event && user) {
      const userSignup = event.signups.find(s => s.user.id === user.id);
      setIsSignedUp(!!userSignup);
    }
  }, [event, user]);

  const loadEvent = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.getById(eventId);
      setEvent(data);
    } catch (err) {
      setError('Failed to load event');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    try {
      await eventsAPI.signup(eventId);
      loadEvent();
    } catch (err: any) {
      alert(err.message || 'Failed to sign up');
    }
  };

  const handleCancelSignup = async () => {
    try {
      await eventsAPI.cancelSignup(eventId);
      loadEvent();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel signup');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      SCHEDULED: { bg: 'bg-blue-500', text: 'Scheduled' },
      REGISTRATION_OPEN: { bg: 'bg-green-500', text: 'Registration Open' },
      IN_PROGRESS: { bg: 'bg-yellow-500', text: 'In Progress' },
      COMPLETED: { bg: 'bg-gray-500', text: 'Completed' },
      CANCELLED: { bg: 'bg-red-500', text: 'Cancelled' },
    };
    return badges[status] || { bg: 'bg-gray-500', text: status };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto"></div>
          <p className="text-green-200 mt-4">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl">{error || 'Event not found'}</p>
          <Link href="/events" className="text-green-400 mt-4 inline-block hover:underline">
            ← Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusBadge(event.status);
  const canSignup = (event.status === 'SCHEDULED' || event.status === 'REGISTRATION_OPEN') && 
                    event._count.signups < event.maxPlayers;

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
            {isAuthenticated ? (
              <Link href="/dashboard" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link href="/events" className="text-green-400 hover:text-green-300 mb-6 inline-block">
          ← Back to Events
        </Link>

        {/* Event Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-6 mb-6">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
            <div>
              <span className={`${statusInfo.bg} text-white px-3 py-1 rounded-full text-sm font-medium`}>
                {statusInfo.text}
              </span>
              <h1 className="text-3xl font-bold text-white mt-3">{event.name}</h1>
              <p className="text-green-200 mt-1">{event.season.name}</p>
            </div>
            {event.buyIn && (
              <div className="text-right">
                <p className="text-green-300 text-sm">Buy-in</p>
                <p className="text-3xl font-bold text-yellow-400">${event.buyIn}</p>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-green-200">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="font-medium text-white">Date & Time</p>
                  <p>{formatDate(event.dateTime)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-green-200">
                <span className="text-2xl">📍</span>
                <div>
                  <p className="font-medium text-white">{event.venue.name}</p>
                  <p>{event.venue.address}</p>
                </div>
              </div>
              {event.director && (
                <div className="flex items-center gap-3 text-green-200">
                  <span className="text-2xl">👤</span>
                  <div>
                    <p className="font-medium text-white">Tournament Director</p>
                    <p>{event.director.name}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-green-200">
                <span className="text-2xl">👥</span>
                <div>
                  <p className="font-medium text-white">Players</p>
                  <p>{event._count.signups} / {event.maxPlayers} registered</p>
                </div>
              </div>
              
              {/* Signup Button */}
              {canSignup && (
                <div className="pt-4">
                  {isSignedUp ? (
                    <button
                      onClick={handleCancelSignup}
                      className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
                    >
                      Cancel Registration
                    </button>
                  ) : (
                    <button
                      onClick={handleSignup}
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
                    >
                      {isAuthenticated ? 'Register for Event' : 'Sign In to Register'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {event.description && (
            <div className="mt-6 pt-6 border-t border-green-600/30">
              <h3 className="text-white font-medium mb-2">About this Event</h3>
              <p className="text-green-200">{event.description}</p>
            </div>
          )}
        </div>

        {/* Results (if completed) */}
        {event.results.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">🏆 Results</h2>
            <div className="space-y-2">
              {event.results.map((result, index) => (
                <div
                  key={result.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                    index === 1 ? 'bg-gray-400/20 border border-gray-400/50' :
                    index === 2 ? 'bg-orange-600/20 border border-orange-600/50' :
                    'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-white w-8">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${result.position}`}
                    </span>
                    <span className="text-white font-medium">{result.user.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-bold">{result.pointsEarned} pts</p>
                    {result.knockouts > 0 && (
                      <p className="text-xs text-green-300">{result.knockouts} KOs</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Registered Players */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            👥 Registered Players ({event._count.signups})
          </h2>
          {event.signups.length === 0 ? (
            <p className="text-green-300/60">No players registered yet</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {event.signups.map((signup) => (
                <div
                  key={signup.id}
                  className="flex items-center gap-2 p-2 bg-white/5 rounded-lg"
                >
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                    {signup.user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-white text-sm truncate">{signup.user.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
