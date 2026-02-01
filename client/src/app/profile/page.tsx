'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, authAPI } from '@/lib/api';

interface UserEvent {
  id: string;
  name: string;
  dateTime: string;
  venue: { name: string };
  signups: { status: string }[];
  results: { position: number; pointsEarned: number }[];
}

export default function ProfilePage() {
  const { user, isAuthenticated, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [myEvents, setMyEvents] = useState<UserEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  const startEditing = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setIsEditing(true);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setSaveMessage({ type: 'error', text: 'Name is required' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const updateData: { name?: string; email?: string } = {};
      if (editName !== user?.name) updateData.name = editName;
      if (editEmail !== user?.email) updateData.email = editEmail || undefined;

      if (Object.keys(updateData).length === 0) {
        setIsEditing(false);
        return;
      }

      const result = await authAPI.updateProfile(updateData);
      // Save new token
      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      await refreshUser();
      setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
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
          {!isEditing ? (
            <>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-white">{user.name}</h1>
                  <p className="text-green-200">{user.email || 'No email set'}</p>
                  <p className="text-green-300/60 text-sm mt-1">
                    Logged in with {getAuthBadge()} • {user.role}
                  </p>
                </div>
                <button
                  onClick={startEditing}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                  ✏️ Edit Profile
                </button>
              </div>

              {saveMessage && (
                <div className={`mt-4 p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {saveMessage.text}
                </div>
              )}

              {/* Admin badge if already admin */}
              {user.role === 'ADMIN' && (
                <div className="mt-6 pt-6 border-t border-green-600/30">
                  <span className="inline-flex items-center gap-2 bg-purple-600/20 text-purple-300 px-4 py-2 rounded-lg">
                    👑 You are an Admin
                  </span>
                  <Link href="/admin" className="ml-4 text-purple-400 hover:text-purple-300 underline">
                    Go to Admin Panel →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">✏️ Edit Profile</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-green-200 text-sm mb-1">Display Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-green-600/50 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-500"
                    placeholder="Your display name"
                  />
                </div>
                
                <div>
                  <label className="block text-green-200 text-sm mb-1">
                    Email {!user.email && <span className="text-yellow-400">(not set)</span>}
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-green-600/50 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-500"
                    placeholder="your@email.com"
                  />
                  {user.authProvider === 'LIGHTNING' && !user.email && (
                    <p className="text-yellow-400/80 text-sm mt-1">
                      💡 Adding an email lets you recover your account and receive notifications
                    </p>
                  )}
                </div>

                {saveMessage && (
                  <div className={`p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {saveMessage.text}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
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
