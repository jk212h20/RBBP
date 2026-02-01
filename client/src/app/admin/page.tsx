'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminAPI, venuesAPI, seasonsAPI, eventsAPI } from '@/lib/api';

interface Stats {
  users: number;
  venues: number;
  events: number;
  seasons: number;
}

interface VenueForm {
  name: string;
  address: string;
  description: string;
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

interface User {
  id: string;
  email: string | null;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  authProvider: string;
}

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'venues' | 'seasons' | 'events' | 'users' | 'setup'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Forms
  const [venueForm, setVenueForm] = useState<VenueForm>({ name: '', address: '', description: '' });
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
  const [setupKey, setSetupKey] = useState('');

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
    try {
      const data = await adminAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
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
    try {
      setError('');
      setMessage('');
      await venuesAPI.create(venueForm);
      setMessage('Venue created successfully!');
      setVenueForm({ name: '', address: '', description: '' });
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
            {['overview', 'users', 'venues', 'seasons', 'events'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab as any);
                  if (tab === 'users' && users.length === 0) {
                    fetchUsers();
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
        {activeTab === 'overview' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-gray-400 text-sm">Total Users</h3>
              <p className="text-3xl font-bold text-green-400">{stats.users}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-gray-400 text-sm">Venues</h3>
              <p className="text-3xl font-bold text-blue-400">{stats.venues}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-gray-400 text-sm">Seasons</h3>
              <p className="text-3xl font-bold text-purple-400">{stats.seasons}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="text-gray-400 text-sm">Events</h3>
              <p className="text-3xl font-bold text-yellow-400">{stats.events}</p>
            </div>
          </div>
        )}

        {/* Venues Tab */}
        {activeTab === 'venues' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create Venue Form */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Create New Venue</h2>
              <form onSubmit={handleCreateVenue} className="space-y-4">
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
                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded font-semibold"
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
                  venues.map((venue) => (
                    <div key={venue.id} className="bg-gray-700 p-3 rounded">
                      <h3 className="font-semibold">{venue.name}</h3>
                      <p className="text-gray-400 text-sm">{venue.address}</p>
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
                  seasons.map((season) => (
                    <div key={season.id} className="bg-gray-700 p-3 rounded">
                      <h3 className="font-semibold">{season.name}</h3>
                      <p className="text-gray-400 text-sm">
                        {new Date(season.startDate).toLocaleDateString()} - {new Date(season.endDate).toLocaleDateString()}
                      </p>
                      {season.isActive && (
                        <span className="inline-block bg-green-600 text-xs px-2 py-1 rounded mt-1">Active</span>
                      )}
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
              <p className="text-gray-400">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Auth</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Role</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Joined</th>
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

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Create New Event</h2>
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
        )}
      </div>
    </div>
  );
}
