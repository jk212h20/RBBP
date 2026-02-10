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
    pointsStructure?: Record<string, number>;
  };
  director?: {
    id: string;
    name: string;
  };
  signups: {
    id: string;
    status: string;
    registeredAt: string;
    checkedInAt?: string;
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

interface PlayerResult {
  userId: string;
  name: string;
  attended: boolean;
  position: number | null;
  knockouts: number;
}

interface PointsPreview {
  first: number;
  second: number;
  third: number;
  totalPool: number;
  playerCount: number;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [userSignupStatus, setUserSignupStatus] = useState<string | null>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const { isAuthenticated, user } = useAuth();

  // Tournament Director state
  const [showManagement, setShowManagement] = useState(false);
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [savingResults, setSavingResults] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pointsPreview, setPointsPreview] = useState<PointsPreview | null>(null);

  // Quick Add Player state
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddResults, setQuickAddResults] = useState<{ id: string; name: string; email: string | null; isGuest: boolean }[]>([]);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState<'search' | 'guest'>('search');
  const [guestName, setGuestName] = useState('');

  const canManageEvent = user && (user.role === 'ADMIN' || user.role === 'TOURNAMENT_DIRECTOR' || user.role === 'VENUE_MANAGER');

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    if (event && user) {
      // Check if user is in the signups list (regardless of status)
      const userSignup = event.signups.find(s => s.user.id === user.id);
      setIsSignedUp(!!userSignup);
      setUserSignupStatus(userSignup?.status || null);
      
      // If user is waitlisted, get their position
      if (userSignup?.status === 'WAITLISTED') {
        eventsAPI.getWaitlistPosition(eventId).then(data => {
          setWaitlistPosition(data.position);
        }).catch(console.error);
      } else {
        setWaitlistPosition(null);
      }
    } else if (!user) {
      setIsSignedUp(false);
      setUserSignupStatus(null);
      setWaitlistPosition(null);
    }
  }, [event, user, eventId]);

  // Load points preview when management panel is shown
  useEffect(() => {
    if (showManagement && canManageEvent && event) {
      eventsAPI.getPointsPreview(eventId).then(data => {
        setPointsPreview(data);
      }).catch(console.error);
    }
  }, [showManagement, canManageEvent, event, eventId, playerResults]);

  useEffect(() => {
    // Initialize player results from signups when event loads
    if (event && canManageEvent) {
      const existingResults = event.results || [];
      const initialResults: PlayerResult[] = event.signups.map(signup => {
        const existingResult = existingResults.find(r => r.user.id === signup.user.id);
        return {
          userId: signup.user.id,
          name: signup.user.name,
          attended: existingResult ? true : signup.status === 'CHECKED_IN',
          position: existingResult?.position || null,
          knockouts: existingResult?.knockouts || 0,
        };
      });
      setPlayerResults(initialResults);
    }
  }, [event, canManageEvent]);

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

  const handleStatusChange = async (newStatus: string) => {
    try {
      await eventsAPI.updateStatus(eventId, newStatus);
      loadEvent();
      setResultMessage({ type: 'success', text: `Event status updated to ${newStatus}` });
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to update status' });
    }
  };

  const toggleAttendance = (userId: string) => {
    setPlayerResults(prev => prev.map(p => 
      p.userId === userId ? { ...p, attended: !p.attended, position: !p.attended ? p.position : null } : p
    ));
  };

  const updatePosition = (userId: string, position: number | null) => {
    setPlayerResults(prev => prev.map(p => 
      p.userId === userId ? { ...p, position } : p
    ));
  };

  const updateKnockouts = (userId: string, knockouts: number) => {
    setPlayerResults(prev => prev.map(p => 
      p.userId === userId ? { ...p, knockouts: Math.max(0, knockouts) } : p
    ));
  };

  // Quick Add Player handlers
  const handleQuickAddSearch = async (query: string) => {
    setQuickAddSearch(query);
    if (query.length < 2) {
      setQuickAddResults([]);
      return;
    }
    setQuickAddLoading(true);
    try {
      const results = await eventsAPI.searchPlayers(eventId, query);
      setQuickAddResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setQuickAddResults([]);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleQuickAddExisting = async (userId: string) => {
    try {
      await eventsAPI.quickAddPlayer(eventId, { userId });
      setQuickAddSearch('');
      setQuickAddResults([]);
      setResultMessage({ type: 'success', text: 'Player added!' });
      loadEvent();
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to add player' });
    }
  };

  const handleQuickAddGuest = async () => {
    if (guestName.trim().length < 2) return;
    try {
      await eventsAPI.quickAddPlayer(eventId, { name: guestName.trim() });
      setGuestName('');
      setQuickAddMode('search');
      setResultMessage({ type: 'success', text: `Guest "${guestName.trim()}" added!` });
      loadEvent();
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to add guest' });
    }
  };

  const handleSaveResults = async (finalize: boolean = false) => {
    const attendedPlayers = playerResults.filter(p => p.attended);
    
    // Validate positions for attended players
    const playersWithPositions = attendedPlayers.filter(p => p.position !== null);
    
    if (finalize) {
      // For finalization, all attended players must have positions
      if (playersWithPositions.length !== attendedPlayers.length) {
        setResultMessage({ type: 'error', text: 'All attended players must have a position to finalize' });
        return;
      }
      
      // Check for duplicate positions
      const positions = playersWithPositions.map(p => p.position);
      const uniquePositions = new Set(positions);
      if (positions.length !== uniquePositions.size) {
        setResultMessage({ type: 'error', text: 'Each player must have a unique position' });
        return;
      }
    }

    setSavingResults(true);
    setResultMessage(null);

    try {
      // Only submit players with positions
      const resultsToSubmit = playersWithPositions.map(p => ({
        userId: p.userId,
        position: p.position!,
        knockouts: p.knockouts,
      }));

      if (resultsToSubmit.length > 0) {
        await eventsAPI.enterResults(eventId, resultsToSubmit);
      }

      if (finalize) {
        await eventsAPI.updateStatus(eventId, 'COMPLETED');
        setResultMessage({ type: 'success', text: 'Results finalized! Standings have been updated.' });
      } else {
        setResultMessage({ type: 'success', text: 'Results saved. You can continue editing.' });
      }
      
      loadEvent();
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to save results' });
    } finally {
      setSavingResults(false);
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
  // Count registered (non-waitlisted) players
  const registeredCount = event.signups.filter(s => s.status !== 'WAITLISTED' && s.status !== 'CANCELLED').length;
  const waitlistedCount = event.signups.filter(s => s.status === 'WAITLISTED').length;
  const isFull = registeredCount >= event.maxPlayers;
  const canSignup = (event.status === 'SCHEDULED' || event.status === 'REGISTRATION_OPEN');
  const canEnterResults = canManageEvent && (event.status === 'IN_PROGRESS' || event.status === 'REGISTRATION_OPEN' || event.status === 'SCHEDULED');
  const isFinalized = event.status === 'COMPLETED';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black">
      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-green-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl md:text-2xl font-bold text-white">
            🃏 RBBP
          </Link>
          <nav className="flex items-center gap-2 md:gap-4">
            <Link href="/events" className="text-white/80 hover:text-white text-sm md:text-base">Events</Link>
            <Link href="/leaderboard" className="text-white/80 hover:text-white text-sm md:text-base hidden sm:inline">Leaderboard</Link>
            {isAuthenticated ? (
              <Link href="/dashboard" className="bg-green-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-green-700 text-sm md:text-base">
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="bg-green-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-green-700 text-sm md:text-base">
                Sign In
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Back Link */}
        <Link href="/events" className="text-green-400 hover:text-green-300 mb-4 md:mb-6 inline-block text-sm md:text-base">
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
                  <p>
                    {registeredCount} / {event.maxPlayers} registered
                    {waitlistedCount > 0 && (
                      <span className="text-yellow-400 ml-2">({waitlistedCount} on waitlist)</span>
                    )}
                  </p>
                  {isFull && <p className="text-yellow-400 text-sm">Event is full - join waitlist</p>}
                </div>
              </div>
              
              {/* User's waitlist status */}
              {userSignupStatus === 'WAITLISTED' && waitlistPosition && (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3">
                  <p className="text-yellow-400 font-medium">
                    ⏳ You are #{waitlistPosition} on the waitlist
                  </p>
                  <p className="text-yellow-300/70 text-sm">
                    You'll be notified if a spot opens up
                  </p>
                </div>
              )}
              
              {/* Signup Button */}
              {canSignup && (
                <div className="pt-4">
                  {isSignedUp ? (
                    <div className="space-y-2">
                      {userSignupStatus === 'WAITLISTED' ? (
                        <button
                          onClick={handleCancelSignup}
                          className="w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 transition"
                        >
                          Leave Waitlist
                        </button>
                      ) : (
                        <button
                          onClick={handleCancelSignup}
                          className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
                        >
                          Cancel Registration
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleSignup}
                      className={`w-full py-3 rounded-lg font-semibold transition ${
                        isFull 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {!isAuthenticated 
                        ? 'Sign In to Register' 
                        : isFull 
                          ? 'Join Waitlist' 
                          : 'Register for Event'}
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

        {/* Tournament Director Management Panel */}
        {canManageEvent && !isFinalized && (
          <div className="bg-orange-500/10 backdrop-blur-sm rounded-xl border border-orange-500/30 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-orange-300">🎯 Tournament Director Panel</h2>
              <button
                onClick={() => setShowManagement(!showManagement)}
                className="text-orange-400 hover:text-orange-300"
              >
                {showManagement ? 'Hide' : 'Show'} Management
              </button>
            </div>

            {showManagement && (
              <div className="space-y-6">
                {/* Status Controls */}
                <div>
                  <h3 className="text-white font-medium mb-2">Event Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {['SCHEDULED', 'REGISTRATION_OPEN', 'IN_PROGRESS'].map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={event.status === status}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          event.status === status 
                            ? 'bg-green-600 text-white cursor-default' 
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Add Player */}
                <div>
                  <h3 className="text-white font-medium mb-2">➕ Quick Add Player</h3>
                  <p className="text-orange-200/70 text-sm mb-3">
                    Add walk-ins who didn&apos;t register. Search existing users or create a guest.
                  </p>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setQuickAddMode('search')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        quickAddMode === 'search' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      🔍 Search User
                    </button>
                    <button
                      onClick={() => setQuickAddMode('guest')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        quickAddMode === 'guest' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      👤 New Guest
                    </button>
                  </div>

                  {quickAddMode === 'search' ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={quickAddSearch}
                        onChange={(e) => handleQuickAddSearch(e.target.value)}
                        placeholder="Type a name to search..."
                        className="w-full p-3 bg-white/10 border border-orange-500/50 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400"
                      />
                      {quickAddLoading && (
                        <div className="absolute right-3 top-3.5">
                          <div className="animate-spin h-5 w-5 border-2 border-orange-400 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                      {quickAddResults.length > 0 && (
                        <div className="mt-2 bg-black/60 border border-orange-500/30 rounded-lg overflow-hidden">
                          {quickAddResults.map(u => (
                            <button
                              key={u.id}
                              onClick={() => handleQuickAddExisting(u.id)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-orange-500/20 transition text-left"
                            >
                              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">{u.name}</p>
                                <p className="text-white/50 text-xs">
                                  {u.isGuest ? 'Guest' : u.email || 'No email'}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {quickAddSearch.length >= 2 && !quickAddLoading && quickAddResults.length === 0 && (
                        <p className="text-orange-200/50 text-sm mt-2">
                          No users found. Try &quot;New Guest&quot; to add them by name.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickAddGuest()}
                        placeholder="Guest name (min 2 chars)..."
                        className="flex-1 p-3 bg-white/10 border border-orange-500/50 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400"
                      />
                      <button
                        onClick={handleQuickAddGuest}
                        disabled={guestName.trim().length < 2}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:opacity-50 text-white rounded-lg font-medium transition"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                {/* Points Preview */}
                {pointsPreview && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                    <h3 className="text-green-400 font-medium mb-2">💰 Points Pool Preview</h3>
                    <p className="text-green-200/70 text-sm mb-3">
                      Based on {pointsPreview.playerCount} checked-in players
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-yellow-400 text-2xl font-bold">🥇 {pointsPreview.first}</p>
                        <p className="text-green-200/60 text-xs">1st Place</p>
                      </div>
                      <div>
                        <p className="text-gray-300 text-2xl font-bold">🥈 {pointsPreview.second}</p>
                        <p className="text-green-200/60 text-xs">2nd Place</p>
                      </div>
                      <div>
                        <p className="text-orange-400 text-2xl font-bold">🥉 {pointsPreview.third}</p>
                        <p className="text-green-200/60 text-xs">3rd Place</p>
                      </div>
                    </div>
                    <p className="text-green-200/50 text-xs mt-3 text-center">
                      Total Pool: {pointsPreview.totalPool} pts (60%/30%/10% split, rounded up)
                    </p>
                  </div>
                )}

                {/* Results Entry */}
                <div>
                  <h3 className="text-white font-medium mb-3">📋 Attendance & Results</h3>
                  <p className="text-orange-200/70 text-sm mb-4">
                    Mark who attended, then enter their finishing positions. Only top 3 get points!
                  </p>

                  {playerResults.length === 0 ? (
                    <p className="text-orange-200/60">No registered players yet</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Header - Desktop */}
                      <div className="hidden md:grid grid-cols-12 gap-2 text-orange-200/70 text-sm font-medium px-3 py-2">
                        <div className="col-span-1">Came</div>
                        <div className="col-span-5">Player</div>
                        <div className="col-span-3">Position</div>
                        <div className="col-span-3">Knockouts</div>
                      </div>

                      {playerResults.map((player) => (
                        <div 
                          key={player.userId}
                          className={`p-3 rounded-lg min-h-[72px] ${
                            player.attended ? 'bg-green-500/20' : 'bg-white/5'
                          }`}
                        >
                          {/* Mobile Layout */}
                          <div className="md:hidden space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={player.attended}
                                  onChange={() => toggleAttendance(player.userId)}
                                  className="w-5 h-5 rounded border-green-600 bg-white/10 text-green-600 focus:ring-green-500"
                                />
                                <span className={`font-medium ${player.attended ? 'text-white' : 'text-gray-400'}`}>
                                  {player.name}
                                </span>
                              </div>
                            </div>
                            <div className={`flex items-center gap-4 pl-8 ${!player.attended ? 'opacity-30 pointer-events-none' : ''}`}>
                              <div className="flex-1">
                                <label className="text-orange-200/70 text-xs block mb-1">Position</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={playerResults.filter(p => p.attended).length}
                                  value={player.position || ''}
                                  onChange={(e) => updatePosition(player.userId, e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="#"
                                  disabled={!player.attended}
                                  className="w-full p-2 bg-white/10 border border-green-600/50 rounded text-white text-center disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <label className="text-orange-200/70 text-xs block mb-1">KOs</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateKnockouts(player.userId, player.knockouts - 1)}
                                    disabled={!player.attended}
                                    className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20 disabled:opacity-50"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center text-white">{player.knockouts}</span>
                                  <button
                                    onClick={() => updateKnockouts(player.userId, player.knockouts + 1)}
                                    disabled={!player.attended}
                                    className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20 disabled:opacity-50"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Desktop Layout */}
                          <div className="hidden md:grid grid-cols-12 gap-2 items-center min-h-[40px]">
                            <div className="col-span-1">
                              <input
                                type="checkbox"
                                checked={player.attended}
                                onChange={() => toggleAttendance(player.userId)}
                                className="w-5 h-5 rounded border-green-600 bg-white/10 text-green-600 focus:ring-green-500"
                              />
                            </div>
                            <div className="col-span-5">
                              <span className={`font-medium ${player.attended ? 'text-white' : 'text-gray-400'}`}>
                                {player.name}
                              </span>
                            </div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                min="1"
                                max={playerResults.filter(p => p.attended).length}
                                value={player.position || ''}
                                onChange={(e) => updatePosition(player.userId, e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="#"
                                disabled={!player.attended}
                                className={`w-full p-2 bg-white/10 border border-green-600/50 rounded text-white text-center disabled:opacity-30 ${!player.attended ? 'invisible' : ''}`}
                              />
                            </div>
                            <div className="col-span-3">
                              <div className={`flex items-center gap-1 ${!player.attended ? 'invisible' : ''}`}>
                                <button
                                  onClick={() => updateKnockouts(player.userId, player.knockouts - 1)}
                                  disabled={!player.attended}
                                  className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20 disabled:opacity-30"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center text-white">{player.knockouts}</span>
                                <button
                                  onClick={() => updateKnockouts(player.userId, player.knockouts + 1)}
                                  disabled={!player.attended}
                                  className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20 disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {resultMessage && (
                    <div className={`mt-4 p-3 rounded-lg ${
                      resultMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {resultMessage.text}
                    </div>
                  )}

                  {playerResults.length > 0 && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => handleSaveResults(false)}
                        disabled={savingResults}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg font-medium transition"
                      >
                        {savingResults ? 'Saving...' : '💾 Save Draft'}
                      </button>
                      <button
                        onClick={() => handleSaveResults(true)}
                        disabled={savingResults}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-6 py-2 rounded-lg font-medium transition"
                      >
                        {savingResults ? 'Finalizing...' : '✅ Finalize Results'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results (if completed) */}
        {event.results.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">🏆 Results {isFinalized && <span className="text-green-400 text-sm font-normal">(Final)</span>}</h2>
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
            👥 Registered Players ({registeredCount})
            {waitlistedCount > 0 && (
              <span className="text-yellow-400 text-sm font-normal ml-2">+ {waitlistedCount} waitlisted</span>
            )}
          </h2>
          {event.signups.length === 0 ? (
            <p className="text-green-300/60">No players registered yet</p>
          ) : (
            <div className="space-y-4">
              {/* Registered players */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {event.signups
                  .filter(s => s.status !== 'WAITLISTED' && s.status !== 'CANCELLED')
                  .map((signup) => (
                    <div
                      key={signup.id}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        signup.status === 'CHECKED_IN' ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/5'
                      }`}
                    >
                      <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
                        {signup.user.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm truncate">{signup.user.name}</span>
                      {signup.status === 'CHECKED_IN' && (
                        <span className="text-green-400 text-xs">✓</span>
                      )}
                    </div>
                  ))}
              </div>
              
              {/* Waitlisted players */}
              {waitlistedCount > 0 && (
                <div>
                  <h3 className="text-yellow-400 font-medium mb-2 text-sm">⏳ Waitlist</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {event.signups
                      .filter(s => s.status === 'WAITLISTED')
                      .map((signup, index) => (
                        <div
                          key={signup.id}
                          className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                        >
                          <div className="w-6 h-6 bg-yellow-600/50 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {index + 1}
                          </div>
                          <span className="text-yellow-200 text-sm truncate">{signup.user.name}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
