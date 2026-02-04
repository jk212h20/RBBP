'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAPI, venuesAPI, seasonsAPI, eventsAPI, withdrawalsAPI } from '@/lib/api';
import ImageUpload from '@/components/ImageUpload';
import WithdrawalsTab from '@/components/WithdrawalsTab';
import BalanceTab from '@/components/BalanceTab';

interface Stats {
  users: number;
  venues: number;
  events: number;
  seasons: number;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  description: string | null;
  isActive: boolean;
  manager?: { id: string; name: string } | null;
  _count?: { events: number };
}

interface VenueForm {
  name: string;
  address: string;
  description: string;
  imageUrl: string | null;
}

interface Season {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  pointsStructure: Record<string, number>;
  _count?: { events: number; standings: number };
}

interface SeasonForm {
  name: string;
  startDate: string;
  endDate: string;
  pointsStructure: string;
}

interface EventForm {
  name: string;
  description: string;
  dateTime: string;
  venueId: string;
  seasonId: string;
  maxPlayers: number;
  buyIn: number;
}

interface BulkEventForm {
  baseName: string;
  description: string;
  startDate: string;
  time: string;
  dayOfWeek: number;
  numberOfWeeks: number;
  venueId: string;
  seasonId: string;
  maxPlayers: number;
  buyIn: number;
  startingNumber: number;
}

interface Event {
  id: string;
  name: string;
  description: string | null;
  dateTime: string;
  status: 'SCHEDULED' | 'REGISTRATION_OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  maxPlayers: number;
  buyIn: number | null;
  venue: { id: string; name: string };
  season: { id: string; name: string };
  _count: { signups: number; results: number };
}

interface Signup {
  id: string;
  status: string;
  registeredAt: string;
  checkedInAt: string | null;
  user: { id: string; name: string; email: string | null };
}

interface ResultEntry {
  userId: string;
  position: number;
  knockouts: number;
}

interface User {
  id: string;
  email: string | null;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  authProvider: string;
  seasonPoints?: number;
  seasonRank?: number | null;
  eventsPlayed?: number;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'venues' | 'seasons' | 'events' | 'users' | 'balances' | 'withdrawals' | 'setup'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  // Forms
  const [venueForm, setVenueForm] = useState<VenueForm>({ name: '', address: '', description: '', imageUrl: null });
  const [seasonForm, setSeasonForm] = useState<SeasonForm>({ 
    name: '', 
    startDate: '', 
    endDate: '', 
    pointsStructure: JSON.stringify({ "1": 100, "2": 75, "3": 60, "4": 50, "5": 40, "knockout": 2 }, null, 2)
  });
  const [eventForm, setEventForm] = useState<EventForm>({ 
    name: '', 
    description: '', 
    dateTime: '', 
    venueId: '', 
    seasonId: '', 
    maxPlayers: 50, 
    buyIn: 0 
  });
  // Recurring event options (integrated into single form)
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringCount, setRecurringCount] = useState(12);
  const [recurringFrequency, setRecurringFrequency] = useState<'weekly' | 'biweekly'>('weekly');
  const [startingNumber, setStartingNumber] = useState(1);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [bulkEventForm, setBulkEventForm] = useState<BulkEventForm>({
    baseName: '',
    description: '',
    startDate: '',
    time: '19:00',
    dayOfWeek: 5, // Friday
    numberOfWeeks: 12,
    venueId: '',
    seasonId: '',
    maxPlayers: 50,
    buyIn: 0,
    startingNumber: 1
  });
  
  // Bulk edit state
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState({
    status: '',
    venueId: '',
    maxPlayers: '',
    buyIn: ''
  });
  const [setupKey, setSetupKey] = useState('');
  
  // Edit modals
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [editVenueForm, setEditVenueForm] = useState<VenueForm>({ name: '', address: '', description: '', imageUrl: null });
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [editSeasonForm, setEditSeasonForm] = useState<SeasonForm>({ name: '', startDate: '', endDate: '', pointsStructure: '' });
  
  // Event management state
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventSignups, setEventSignups] = useState<Signup[]>([]);
  const [loadingSignups, setLoadingSignups] = useState(false);
  const [resultsMode, setResultsMode] = useState(false);
  const [resultEntries, setResultEntries] = useState<ResultEntry[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchStats();
      fetchVenues();
      fetchSeasons();
    }
  }, [user]);

  const fetchStats = async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const data = await adminAPI.getStats();
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch stats:', err);
      setStatsError(err.message || 'Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchVenues = async () => {
    try {
      const data = await venuesAPI.getAll();
      setVenues(data);
    } catch (err) {
      console.error('Failed to fetch venues:', err);
    }
  };

  const fetchSeasons = async () => {
    try {
      const data = await seasonsAPI.getAll();
      setSeasons(data);
    } catch (err) {
      console.error('Failed to fetch seasons:', err);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await adminAPI.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setError('');
      setMessage('');
      await adminAPI.updateUserRole(userId, newRole);
      setMessage('User role updated successfully!');
      fetchUsers();
      fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to update user role');
    }
  };

  const handleBecomeAdmin = async () => {
    try {
      setError('');
      setMessage('');
      const data = await adminAPI.promoteToAdmin(setupKey);
      setMessage(data.message);
      // Refresh the page to update user role
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Failed to become admin');
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Validate required fields before submitting
    if (!venueForm.name.trim() || !venueForm.address.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    
    try {
      setError('');
      setMessage('');
      await venuesAPI.create(venueForm);
      setMessage('Venue created successfully!');
      setVenueForm({ name: '', address: '', description: '', imageUrl: null });
      fetchVenues();
      fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to create venue');
    }
  };

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setMessage('');
      const data = {
        ...seasonForm,
        pointsStructure: JSON.parse(seasonForm.pointsStructure)
      };
      await seasonsAPI.create(data);
      setMessage('Season created successfully!');
      setSeasonForm({ 
        name: '', 
        startDate: '', 
        endDate: '', 
        pointsStructure: JSON.stringify({ "1": 100, "2": 75, "3": 60, "4": 50, "5": 40, "knockout": 2 }, null, 2)
      });
      fetchSeasons();
      fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to create season');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setMessage('');
      await eventsAPI.create(eventForm);
      setMessage('Event created successfully!');
      setEventForm({ name: '', description: '', dateTime: '', venueId: '', seasonId: '', maxPlayers: 50, buyIn: 0 });
      fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to create event');
    }
  };

  // Venue edit/delete handlers
  const handleEditVenue = (venue: Venue) => {
    setEditingVenue(venue);
    setEditVenueForm({
      name: venue.name,
      address: venue.address,
      description: venue.description || '',
      imageUrl: (venue as any).imageUrl || null
    });
  };

  const handleUpdateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenue) return;
    try {
      setError('');
      setMessage('');
      await venuesAPI.update(editingVenue.id, editVenueForm);
      setMessage('Venue updated successfully!');
      setEditingVenue(null);
      fetchVenues();
    } catch (err: any) {
      setError(err.message || 'Failed to update venue');
    }
  };

  const handleDeleteVenue = async (venueId: string) => {
    if (!confirm('Are you sure you want to delete this venue?')) return;
    try {
      setError('');
      setMessage('');
      await venuesAPI.delete(venueId);
      setMessage('Venue deleted successfully!');
      fetchVenues();
      fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to delete venue');
    }
  };

  // Season edit/delete handlers
  const handleEditSeason = (season: Season) => {
    setEditingSeason(season);
    setEditSeasonForm({
      name: season.name,
      startDate: season.startDate.split('T')[0],
      endDate: season.endDate.split('T')[0],
      pointsStructure: JSON.stringify(season.pointsStructure, null, 2)
    });
  };

  const handleUpdateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeason) return;
    try {
      setError('');
      setMessage('');
      await seasonsAPI.update(editingSeason.id, {
        name: editSeasonForm.name,
        startDate: editSeasonForm.startDate,
        endDate: editSeasonForm.endDate
      });
      setMessage('Season updated successfully!');
      setEditingSeason(null);
      fetchSeasons();
    } catch (err: any) {
      setError(err.message || 'Failed to update season');
    }
  };

  const handleActivateSeason = async (seasonId: string) => {
    try {
      setError('');
      setMessage('');
      await seasonsAPI.activate(seasonId);
      setMessage('Season activated successfully!');
      fetchSeasons();
    } catch (err: any) {
      setError(err.message || 'Failed to activate season');
    }
  };

  const handleDeleteSeason = async (seasonId: string) => {
    if (!confirm('Are you sure you want to delete this season? This cannot be undone.')) return;
    try {
      setError('');
      setMessage('');
      await seasonsAPI.delete(seasonId);
      setMessage('Season deleted successfully!');
      fetchSeasons();
      fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to delete season');
    }
  };

  // Event management functions
  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const data = await eventsAPI.getAll();
      setEvents(data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleStatusChange = async (eventId: string, newStatus: string) => {
    try {
      setError('');
      setMessage('');
      await eventsAPI.updateStatus(eventId, newStatus);
      setMessage('Event status updated!');
      fetchEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event? This will remove all signups and results.')) return;
    try {
      setError('');
      setMessage('');
      await eventsAPI.delete(eventId);
      setMessage('Event deleted!');
      fetchEvents();
      fetchStats();
    } catch (err: any) {
      setError(err.message || 'Failed to delete event');
    }
  };

  const openEventDetails = async (event: Event) => {
    setSelectedEvent(event);
    setResultsMode(false);
    setLoadingSignups(true);
    try {
      const signups = await eventsAPI.getSignups(event.id);
      setEventSignups(signups);
      // Initialize result entries from signups
      setResultEntries(signups.map((s: Signup, i: number) => ({
        userId: s.user.id,
        position: i + 1,
        knockouts: 0
      })));
    } catch (err) {
      console.error('Failed to fetch signups:', err);
    } finally {
      setLoadingSignups(false);
    }
  };

  const handleCheckIn = async (userId: string) => {
    if (!selectedEvent) return;
    try {
      setError('');
      await eventsAPI.checkIn(selectedEvent.id, userId);
      setMessage('Player checked in!');
      const signups = await eventsAPI.getSignups(selectedEvent.id);
      setEventSignups(signups);
    } catch (err: any) {
      setError(err.message || 'Failed to check in player');
    }
  };

  const handleSubmitResults = async () => {
    if (!selectedEvent) return;
    try {
      setError('');
      setMessage('');
      await eventsAPI.enterResults(selectedEvent.id, resultEntries);
      setMessage('Results saved! Standings updated.');
      setSelectedEvent(null);
      fetchEvents();
    } catch (err: any) {
      setError(err.message || 'Failed to save results');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Show access denied if user is not admin
  if (user && user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="max-w-md mx-auto">
          <Link href="/dashboard" className="text-green-400 hover:text-green-300 mb-8 inline-block">
            ← Back to Dashboard
          </Link>
          
          <div className="bg-gray-800 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold mb-4">🔒 Access Denied</h1>
            <p className="text-gray-400 mb-6">
              You don't have permission to access the admin panel.
            </p>
            <Link 
              href="/dashboard"
              className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded font-semibold"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">🃏 Admin Dashboard</h1>
          <Link href="/dashboard" className="text-green-400 hover:text-green-300">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Tabs - Scrollable on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-2 mb-6 border-b border-gray-700 pb-4 min-w-max">
            {['overview', 'users', 'venues', 'seasons', 'events', 'balances', 'withdrawals'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab as any);
                  if (tab === 'users' && users.length === 0) {
                    fetchUsers();
                  }
                  if (tab === 'events' && events.length === 0) {
                    fetchEvents();
                  }
                }}
                className={`px-4 py-2 rounded-t font-semibold capitalize whitespace-nowrap ${
                  activeTab === tab 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded mb-4">
            {error}
          </div>
        )}
        {message && (
          <div className="bg-green-500/20 border border-green-500 text-green-400 p-3 rounded mb-4">
            {message}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            {statsLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                <p className="text-gray-400 mt-2">Loading stats...</p>
              </div>
            ) : statsError ? (
              <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded">
                <p className="font-bold">Error loading stats:</p>
                <p>{statsError}</p>
                <button 
                  onClick={fetchStats}
                  className="mt-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                >
                  Retry
                </button>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Clickable Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={() => { setActiveTab('users'); if (users.length === 0) fetchUsers(); }}
                    className="bg-gray-800 rounded-lg p-6 text-left hover:bg-gray-700 transition group border border-transparent hover:border-green-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-gray-400 text-sm group-hover:text-green-400 transition">Total Users</h3>
                        <p className="text-3xl font-bold text-green-400">{stats.users}</p>
                      </div>
                      <span className="text-3xl opacity-50 group-hover:opacity-100 transition">👥</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-2 group-hover:text-gray-400">Click to manage →</p>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('venues')}
                    className="bg-gray-800 rounded-lg p-6 text-left hover:bg-gray-700 transition group border border-transparent hover:border-blue-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-gray-400 text-sm group-hover:text-blue-400 transition">Venues</h3>
                        <p className="text-3xl font-bold text-blue-400">{stats.venues}</p>
                      </div>
                      <span className="text-3xl opacity-50 group-hover:opacity-100 transition">📍</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-2 group-hover:text-gray-400">Click to manage →</p>
                  </button>
                  
                  <button
                    onClick={() => setActiveTab('seasons')}
                    className="bg-gray-800 rounded-lg p-6 text-left hover:bg-gray-700 transition group border border-transparent hover:border-purple-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-gray-400 text-sm group-hover:text-purple-400 transition">Seasons</h3>
                        <p className="text-3xl font-bold text-purple-400">{stats.seasons}</p>
                      </div>
                      <span className="text-3xl opacity-50 group-hover:opacity-100 transition">🏆</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-2 group-hover:text-gray-400">Click to manage →</p>
                  </button>
                  
                  <button
                    onClick={() => { setActiveTab('events'); if (events.length === 0) fetchEvents(); }}
                    className="bg-gray-800 rounded-lg p-6 text-left hover:bg-gray-700 transition group border border-transparent hover:border-yellow-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-gray-400 text-sm group-hover:text-yellow-400 transition">Events</h3>
                        <p className="text-3xl font-bold text-yellow-400">{stats.events}</p>
                      </div>
                      <span className="text-3xl opacity-50 group-hover:opacity-100 transition">📅</span>
                    </div>
                    <p className="text-gray-500 text-xs mt-2 group-hover:text-gray-400">Click to manage →</p>
                  </button>
                </div>

                {/* Active Season Info */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-r from-purple-900/30 to-purple-800/20 rounded-lg p-6 border border-purple-500/30">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      🏆 Active Season
                    </h3>
                    {seasons.find((s: Season) => s.isActive) ? (
                      <div>
                        <p className="text-2xl font-bold text-purple-400">
                          {seasons.find((s: Season) => s.isActive)?.name}
                        </p>
                        <p className="text-gray-400 text-sm mt-1">
                          {new Date(seasons.find((s: Season) => s.isActive)?.startDate).toLocaleDateString()} - {new Date(seasons.find((s: Season) => s.isActive)?.endDate).toLocaleDateString()}
                        </p>
                        <p className="text-gray-500 text-xs mt-2">
                          {seasons.find((s: Season) => s.isActive)?._count?.events || 0} events • {seasons.find((s: Season) => s.isActive)?._count?.standings || 0} players ranked
                        </p>
                      </div>
                    ) : (
                      <div className="text-yellow-400">
                        <p>⚠️ No active season</p>
                        <button
                          onClick={() => setActiveTab('seasons')}
                          className="text-sm text-purple-400 hover:text-purple-300 mt-2"
                        >
                          Create or activate a season →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                      📊 Quick Stats
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-700/50 rounded p-3">
                        <p className="text-gray-400 text-xs">Active Venues</p>
                        <p className="text-xl font-bold text-blue-400">{venues.filter((v: Venue) => v.isActive !== false).length}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded p-3">
                        <p className="text-gray-400 text-xs">Total Seasons</p>
                        <p className="text-xl font-bold text-purple-400">{seasons.length}</p>
                      </div>
                      <div className="bg-gray-700/50 rounded p-3">
                        <p className="text-gray-400 text-xs">Upcoming Events</p>
                        <p className="text-xl font-bold text-yellow-400">
                          {events.filter((e: Event) => new Date(e.dateTime) > new Date() && e.status !== 'CANCELLED').length}
                        </p>
                      </div>
                      <div className="bg-gray-700/50 rounded p-3">
                        <p className="text-gray-400 text-xs">Completed Events</p>
                        <p className="text-xl font-bold text-green-400">
                          {events.filter((e: Event) => e.status === 'COMPLETED').length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Activity / Upcoming Events */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    📅 Upcoming Events
                  </h3>
                  {events.filter((e: Event) => new Date(e.dateTime) > new Date() && e.status !== 'CANCELLED').length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-gray-400">No upcoming events</p>
                      <button
                        onClick={() => { setActiveTab('events'); if (events.length === 0) fetchEvents(); }}
                        className="text-green-400 hover:text-green-300 text-sm mt-2"
                      >
                        Create an event →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {events
                        .filter((e: Event) => new Date(e.dateTime) > new Date() && e.status !== 'CANCELLED')
                        .sort((a: Event, b: Event) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
                        .slice(0, 5)
                        .map((event: Event) => (
                          <div key={event.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded">
                            <div>
                              <p className="font-medium">{event.name}</p>
                              <p className="text-gray-400 text-sm">
                                📍 {event.venue.name} • 📆 {new Date(event.dateTime).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs px-2 py-1 rounded ${
                                event.status === 'REGISTRATION_OPEN' ? 'bg-blue-600/30 text-blue-400' :
                                event.status === 'IN_PROGRESS' ? 'bg-yellow-600/30 text-yellow-400' :
                                'bg-gray-600/30 text-gray-400'
                              }`}>
                                {event.status === 'REGISTRATION_OPEN' ? '📝 Open' :
                                 event.status === 'IN_PROGRESS' ? '🎮 Live' :
                                 '📋 Scheduled'}
                              </span>
                              <p className="text-gray-500 text-xs mt-1">{event._count.signups} signups</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No stats available</p>
            )}
          </>
        )}

        {/* Venues Tab */}
        {activeTab === 'venues' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Venue Form */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Create New Venue</h2>
              <form onSubmit={handleCreateVenue} className="space-y-4" autoComplete="off">
                <div>
                  <label className="block text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={venueForm.name}
                    onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="e.g., Blue Marlin Beach Bar"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Address *</label>
                  <input
                    type="text"
                    value={venueForm.address}
                    onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="e.g., West End, Roatan"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Description</label>
                  <textarea
                    value={venueForm.description}
                    onChange={(e) => setVenueForm({ ...venueForm, description: e.target.value })}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                    rows={3}
                    placeholder="Describe the venue..."
                  />
                </div>
                <ImageUpload
                  currentImage={venueForm.imageUrl}
                  onImageChange={(imageData) => setVenueForm({ ...venueForm, imageUrl: imageData })}
                  label="Venue Image"
                />
                <button
                  type="submit"
                  disabled={!venueForm.name.trim() || !venueForm.address.trim()}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded font-semibold"
                >
                  Create Venue
                </button>
              </form>
            </div>

            {/* Existing Venues */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Existing Venues ({venues.length})</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {venues.length === 0 ? (
                  <p className="text-gray-400">No venues yet. Create one!</p>
                ) : (
                  venues.map((venue: Venue) => (
                    <div key={venue.id} className="bg-gray-700 p-3 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <Link href={`/venues/${venue.id}`} className="font-semibold text-blue-400 hover:text-blue-300">
                            {venue.name}
                          </Link>
                          <p className="text-gray-400 text-sm">{venue.address}</p>
                          {venue._count?.events !== undefined && (
                            <p className="text-gray-500 text-xs mt-1">{venue._count.events} events</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditVenue(venue)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVenue(venue.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Seasons Tab */}
        {activeTab === 'seasons' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Season Form */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Create New Season</h2>
              <form onSubmit={handleCreateSeason} className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={seasonForm.name}
                    onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="e.g., Spring 2026"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={seasonForm.startDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, startDate: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={seasonForm.endDate}
                    onChange={(e) => setSeasonForm({ ...seasonForm, endDate: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Points Structure (JSON)</label>
                  <textarea
                    value={seasonForm.pointsStructure}
                    onChange={(e) => setSeasonForm({ ...seasonForm, pointsStructure: e.target.value })}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white font-mono text-sm"
                    rows={5}
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-semibold"
                >
                  Create Season
                </button>
              </form>
            </div>

            {/* Existing Seasons */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Existing Seasons ({seasons.length})</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {seasons.length === 0 ? (
                  <p className="text-gray-400">No seasons yet. Create one!</p>
                ) : (
                  seasons.map((season: Season) => (
                    <div key={season.id} className="bg-gray-700 p-3 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <Link href={`/leaderboard?season=${season.id}`} className="font-semibold text-purple-400 hover:text-purple-300">
                            {season.name}
                          </Link>
                          <p className="text-gray-400 text-sm">
                            {new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}
                          </p>
                          {season._count?.events !== undefined && (
                            <p className="text-gray-500 text-xs mt-1">{season._count.events} events</p>
                          )}
                          {season.isActive && (
                            <span className="inline-block bg-green-600 text-xs px-2 py-1 rounded mt-1">Active</span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {!season.isActive && (
                            <button
                              onClick={() => handleActivateSeason(season.id)}
                              className="text-green-400 hover:text-green-300 text-sm"
                            >
                              ✅ Activate
                            </button>
                          )}
                          <button
                            onClick={() => handleEditSeason(season)}
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDeleteSeason(season.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">👥 User Management</h2>
            
            {loadingUsers ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                <p className="text-gray-400 mt-2">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-4">No users found.</p>
                <button 
                  onClick={fetchUsers}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                >
                  Reload Users
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Points</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Auth</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Role</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Joined</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-3 px-4">
                          <span className="font-medium">{u.name}</span>
                          {u.id === user?.id && (
                            <span className="ml-2 text-xs bg-green-600 px-2 py-0.5 rounded">You</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {u.email || <span className="text-gray-500 italic">No email</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-yellow-400 font-bold">{u.seasonPoints || 0}</span>
                            {u.seasonRank && (
                              <span className="text-gray-500 text-xs">#{u.seasonRank}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-1 rounded ${
                            u.authProvider === 'GOOGLE' ? 'bg-blue-600/20 text-blue-400' :
                            u.authProvider === 'LIGHTNING' ? 'bg-yellow-600/20 text-yellow-400' :
                            'bg-gray-600/20 text-gray-400'
                          }`}>
                            {u.authProvider === 'GOOGLE' ? '🔵 Google' :
                             u.authProvider === 'LIGHTNING' ? '⚡ Lightning' :
                             '✉️ Email'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            disabled={u.id === user?.id}
                            className={`bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm ${
                              u.id === user?.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            } ${
                              u.role === 'ADMIN' ? 'text-purple-400' :
                              u.role === 'VENUE_MANAGER' ? 'text-blue-400' :
                              u.role === 'TOURNAMENT_DIRECTOR' ? 'text-orange-400' :
                              'text-gray-300'
                            }`}
                          >
                            <option value="PLAYER">Player</option>
                            <option value="TOURNAMENT_DIRECTOR">Tournament Director</option>
                            <option value="VENUE_MANAGER">Venue Manager</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          {u.id !== user?.id && (
                            <div className="flex gap-2">
                              <button
                                onClick={async () => {
                                  try {
                                    await adminAPI.updateUserStatus(u.id, !u.isActive);
                                    setMessage(`User ${u.isActive ? 'deactivated' : 'activated'} successfully!`);
                                    fetchUsers();
                                  } catch (err: any) {
                                    setError(err.message || 'Failed to update user status');
                                  }
                                }}
                                className={`text-xs px-2 py-1 rounded ${
                                  u.isActive 
                                    ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' 
                                    : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                }`}
                              >
                                {u.isActive ? '🚫 Deactivate' : '✅ Activate'}
                              </button>
                              {!u.isActive && (
                                <button
                                  onClick={async () => {
                                    if (!confirm(`⚠️ PERMANENTLY DELETE "${u.name}"?\n\nThis will:\n• Remove all their data\n• Free up their email/lightning for reuse\n• Create a backup (recoverable by admin)\n\nThis action cannot be undone!`)) return;
                                    try {
                                      setError('');
                                      const result = await adminAPI.deleteUser(u.id);
                                      setMessage(result.message);
                                      fetchUsers();
                                      fetchStats();
                                    } catch (err: any) {
                                      setError(err.message || 'Failed to delete user');
                                    }
                                  }}
                                  className="text-xs px-2 py-1 rounded bg-red-600/40 text-red-300 hover:bg-red-600/60"
                                  title="Permanently delete this deactivated account"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-4 text-gray-400 text-sm">
              <p>💡 <strong>Roles:</strong></p>
              <ul className="mt-2 space-y-1 ml-4">
                <li><span className="text-purple-400">Admin</span> - Full access to all features</li>
                <li><span className="text-blue-400">Venue Manager</span> - Can manage assigned venues and their events</li>
                <li><span className="text-orange-400">Tournament Director</span> - Can manage events and enter results</li>
                <li><span className="text-gray-300">Player</span> - Can register for events and view standings</li>
              </ul>
            </div>
          </div>
        )}

        {/* Balances Tab */}
        {activeTab === 'balances' && (
          <BalanceTab users={users} fetchUsers={fetchUsers} setMessage={setMessage} setError={setError} />
        )}

        {/* Withdrawals Tab */}
        {activeTab === 'withdrawals' && (
          <WithdrawalsTab users={users} fetchUsers={fetchUsers} setMessage={setMessage} setError={setError} />
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            {/* Event List */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">📅 All Events ({events.length})</h2>
                <button onClick={fetchEvents} className="text-green-400 hover:text-green-300 text-sm">
                  🔄 Refresh
                </button>
              </div>
              
              {loadingEvents ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                </div>
              ) : events.length === 0 ? (
                <p className="text-gray-400">No events yet. Create one below!</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {events.map((event) => (
                    <div key={event.id} className="bg-gray-700 p-4 rounded">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <Link href={`/events/${event.id}`} className="font-semibold text-yellow-400 hover:text-yellow-300">
                            {event.name}
                          </Link>
                          <p className="text-gray-400 text-sm">
                            📍 {event.venue.name} • 📆 {new Date(event.dateTime).toLocaleString()}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            👥 {event._count.signups} signups • 🏆 {event._count.results} results
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <select
                            value={event.status}
                            onChange={(e) => handleStatusChange(event.id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded border-0 ${
                              event.status === 'COMPLETED' ? 'bg-green-600/30 text-green-400' :
                              event.status === 'IN_PROGRESS' ? 'bg-yellow-600/30 text-yellow-400' :
                              event.status === 'REGISTRATION_OPEN' ? 'bg-blue-600/30 text-blue-400' :
                              event.status === 'CANCELLED' ? 'bg-red-600/30 text-red-400' :
                              'bg-gray-600/30 text-gray-400'
                            }`}
                          >
                            <option value="SCHEDULED">📋 Scheduled</option>
                            <option value="REGISTRATION_OPEN">📝 Registration Open</option>
                            <option value="IN_PROGRESS">🎮 In Progress</option>
                            <option value="COMPLETED">✅ Completed</option>
                            <option value="CANCELLED">❌ Cancelled</option>
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEventDetails(event)}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              👥 Manage
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="text-red-400 hover:text-red-300 text-xs"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk Create Events Form */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">📅 Bulk Create Recurring Events</h2>
                <button
                  onClick={() => setShowBulkForm(!showBulkForm)}
                  className={`px-4 py-2 rounded text-sm font-semibold ${showBulkForm ? 'bg-gray-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  {showBulkForm ? '✕ Close' : '🔄 Create Multiple Events'}
                </button>
              </div>
              
              {showBulkForm && (venues.length === 0 || seasons.length === 0) && (
                <div className="text-yellow-400 bg-yellow-400/10 p-4 rounded">
                  ⚠️ You need to create at least one venue and one season before creating events.
                </div>
              )}
              
              {showBulkForm && venues.length > 0 && seasons.length > 0 && (
                <div className="space-y-4">
                  <p className="text-gray-400 text-sm">
                    Create multiple events at once for a recurring schedule (e.g., every Friday for 12 weeks).
                    Events will be named with # suffix like "Friday Night Poker #1", "Friday Night Poker #2", etc.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-400 mb-1">Base Event Name *</label>
                      <input
                        type="text"
                        value={bulkEventForm.baseName}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, baseName: e.target.value })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                        placeholder="e.g., Friday Night Poker"
                      />
                      <p className="text-gray-500 text-xs mt-1">Events will be named: "{bulkEventForm.baseName || 'Event'} #1", "{bulkEventForm.baseName || 'Event'} #2", etc.</p>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Day of Week *</label>
                      <select
                        value={bulkEventForm.dayOfWeek}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, dayOfWeek: parseInt(e.target.value) })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Start Date *</label>
                      <input
                        type="date"
                        value={bulkEventForm.startDate}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, startDate: e.target.value })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                      <p className="text-gray-500 text-xs mt-1">First event will be on or after this date</p>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Time *</label>
                      <input
                        type="time"
                        value={bulkEventForm.time}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, time: e.target.value })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Number of Weeks *</label>
                      <input
                        type="number"
                        min="1"
                        max="52"
                        value={bulkEventForm.numberOfWeeks}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, numberOfWeeks: parseInt(e.target.value) || 1 })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                      <p className="text-gray-500 text-xs mt-1">Will create {bulkEventForm.numberOfWeeks} events</p>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Starting # Number</label>
                      <input
                        type="number"
                        min="1"
                        value={bulkEventForm.startingNumber}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, startingNumber: parseInt(e.target.value) || 1 })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                      <p className="text-gray-500 text-xs mt-1">First event will be #{bulkEventForm.startingNumber}</p>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Venue *</label>
                      <select
                        value={bulkEventForm.venueId}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, venueId: e.target.value })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      >
                        <option value="">Select a venue</option>
                        {venues.map((venue) => (
                          <option key={venue.id} value={venue.id}>{venue.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Season *</label>
                      <select
                        value={bulkEventForm.seasonId}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, seasonId: e.target.value })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      >
                        <option value="">Select a season</option>
                        {seasons.map((season) => (
                          <option key={season.id} value={season.id}>{season.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Max Players</label>
                      <input
                        type="number"
                        value={bulkEventForm.maxPlayers}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, maxPlayers: parseInt(e.target.value) })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-400 mb-1">Buy-in ($)</label>
                      <input
                        type="number"
                        value={bulkEventForm.buyIn}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, buyIn: parseFloat(e.target.value) })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-gray-400 mb-1">Description (optional)</label>
                      <textarea
                        value={bulkEventForm.description}
                        onChange={(e) => setBulkEventForm({ ...bulkEventForm, description: e.target.value })}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                        rows={2}
                        placeholder="Description for all events..."
                      />
                    </div>
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        disabled={bulkCreating || !bulkEventForm.baseName || !bulkEventForm.startDate || !bulkEventForm.venueId || !bulkEventForm.seasonId}
                        onClick={async () => {
                          try {
                            setBulkCreating(true);
                            setError('');
                            setMessage('');
                            const result = await eventsAPI.createBulk(bulkEventForm);
                            setMessage(result.message);
                            setBulkEventForm({
                              baseName: '',
                              description: '',
                              startDate: '',
                              time: '19:00',
                              dayOfWeek: 5,
                              numberOfWeeks: 12,
                              venueId: '',
                              seasonId: '',
                              maxPlayers: 50,
                              buyIn: 0,
                              startingNumber: 1
                            });
                            setShowBulkForm(false);
                            fetchEvents();
                            fetchStats();
                          } catch (err: any) {
                            setError(err.message || 'Failed to create bulk events');
                          } finally {
                            setBulkCreating(false);
                          }
                        }}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded font-semibold"
                      >
                        {bulkCreating ? '⏳ Creating Events...' : `🔄 Create ${bulkEventForm.numberOfWeeks} Events`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Create Single Event Form */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">➕ Create Single Event</h2>
            {venues.length === 0 || seasons.length === 0 ? (
              <div className="text-yellow-400 bg-yellow-400/10 p-4 rounded">
                ⚠️ You need to create at least one venue and one season before creating events.
              </div>
            ) : (
              <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 mb-1">Event Name *</label>
                  <input
                    type="text"
                    value={eventForm.name}
                    onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                    placeholder="e.g., Tuesday Night Poker"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={eventForm.dateTime}
                    onChange={(e) => setEventForm({ ...eventForm, dateTime: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Venue *</label>
                  <select
                    value={eventForm.venueId}
                    onChange={(e) => setEventForm({ ...eventForm, venueId: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="">Select a venue</option>
                    {venues.map((venue) => (
                      <option key={venue.id} value={venue.id}>{venue.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Season *</label>
                  <select
                    value={eventForm.seasonId}
                    onChange={(e) => setEventForm({ ...eventForm, seasonId: e.target.value })}
                    required
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  >
                    <option value="">Select a season</option>
                    {seasons.map((season) => (
                      <option key={season.id} value={season.id}>{season.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Max Players</label>
                  <input
                    type="number"
                    value={eventForm.maxPlayers}
                    onChange={(e) => setEventForm({ ...eventForm, maxPlayers: parseInt(e.target.value) })}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Buy-in ($)</label>
                  <input
                    type="number"
                    value={eventForm.buyIn}
                    onChange={(e) => setEventForm({ ...eventForm, buyIn: parseFloat(e.target.value) })}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-gray-400 mb-1">Description</label>
                  <textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                    rows={3}
                    placeholder="Event description..."
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-semibold"
                  >
                    Create Event
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Event Management Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedEvent.name}</h2>
                <p className="text-gray-400 text-sm">
                  📍 {selectedEvent.venue.name} • 📆 {new Date(selectedEvent.dateTime).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Toggle between Check-in and Results */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setResultsMode(false)}
                className={`px-4 py-2 rounded ${!resultsMode ? 'bg-green-600' : 'bg-gray-700'}`}
              >
                👥 Check-in ({eventSignups.length})
              </button>
              <button
                onClick={() => setResultsMode(true)}
                className={`px-4 py-2 rounded ${resultsMode ? 'bg-green-600' : 'bg-gray-700'}`}
              >
                🏆 Enter Results
              </button>
            </div>

            {loadingSignups ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
              </div>
            ) : !resultsMode ? (
              /* Check-in Mode */
              <div className="space-y-2">
                {eventSignups.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No signups yet</p>
                ) : (
                  eventSignups.map((signup) => (
                    <div key={signup.id} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                      <div>
                        <span className="font-medium">{signup.user.name}</span>
                        {signup.user.email && (
                          <span className="text-gray-400 text-sm ml-2">{signup.user.email}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {signup.status === 'CHECKED_IN' ? (
                          <span className="text-green-400 text-sm">✅ Checked In</span>
                        ) : (
                          <button
                            onClick={() => handleCheckIn(signup.user.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                          >
                            Check In
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* Results Entry Mode */
              <div className="space-y-4">
                <p className="text-gray-400 text-sm">Enter finishing positions and knockouts for each player:</p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {resultEntries.map((entry, idx) => {
                    const signup = eventSignups.find(s => s.user.id === entry.userId);
                    return (
                      <div key={entry.userId} className="flex items-center gap-3 bg-gray-700 p-3 rounded">
                        <div className="flex-1">
                          <span className="font-medium">{signup?.user.name || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-gray-400 text-sm">Pos:</label>
                          <input
                            type="number"
                            min="1"
                            value={entry.position}
                            onChange={(e) => {
                              const newEntries = [...resultEntries];
                              newEntries[idx].position = parseInt(e.target.value) || 1;
                              setResultEntries(newEntries);
                            }}
                            className="w-16 p-2 bg-gray-600 border border-gray-500 rounded text-white text-center"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-gray-400 text-sm">KOs:</label>
                          <input
                            type="number"
                            min="0"
                            value={entry.knockouts}
                            onChange={(e) => {
                              const newEntries = [...resultEntries];
                              newEntries[idx].knockouts = parseInt(e.target.value) || 0;
                              setResultEntries(newEntries);
                            }}
                            className="w-16 p-2 bg-gray-600 border border-gray-500 rounded text-white text-center"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={handleSubmitResults}
                  disabled={resultEntries.length === 0}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded font-semibold"
                >
                  💾 Save Results & Update Standings
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Season Modal */}
      {editingSeason && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Season</h2>
            <form onSubmit={handleUpdateSeason} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={editSeasonForm.name}
                  onChange={(e) => setEditSeasonForm({ ...editSeasonForm, name: e.target.value })}
                  required
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Start Date *</label>
                <input
                  type="date"
                  value={editSeasonForm.startDate}
                  onChange={(e) => setEditSeasonForm({ ...editSeasonForm, startDate: e.target.value })}
                  required
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">End Date *</label>
                <input
                  type="date"
                  value={editSeasonForm.endDate}
                  onChange={(e) => setEditSeasonForm({ ...editSeasonForm, endDate: e.target.value })}
                  required
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSeason(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Venue Modal */}
      {editingVenue && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Edit Venue</h2>
            <form onSubmit={handleUpdateVenue} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  value={editVenueForm.name}
                  onChange={(e) => setEditVenueForm({ ...editVenueForm, name: e.target.value })}
                  required
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Address *</label>
                <input
                  type="text"
                  value={editVenueForm.address}
                  onChange={(e) => setEditVenueForm({ ...editVenueForm, address: e.target.value })}
                  required
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Description</label>
                <textarea
                  value={editVenueForm.description}
                  onChange={(e) => setEditVenueForm({ ...editVenueForm, description: e.target.value })}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  rows={3}
                />
              </div>
              <ImageUpload
                currentImage={editVenueForm.imageUrl}
                onImageChange={(imageData) => setEditVenueForm({ ...editVenueForm, imageUrl: imageData })}
                label="Venue Image"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingVenue(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
