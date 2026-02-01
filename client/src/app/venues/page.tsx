'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { venuesAPI } from '@/lib/api';

interface Venue {
  id: string;
  name: string;
  address: string;
  description?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  _count?: {
    events: number;
  };
}

export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    setLoading(true);
    try {
      const data = await venuesAPI.getAll();
      setVenues(data);
    } catch (err) {
      setError('Failed to load venues');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
            <Link href="/venues" className="text-green-400 font-medium">Venues</Link>
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📍 Poker Venues</h1>
          <p className="text-green-200">Find poker nights at venues across Roatan</p>
        </div>

        {/* Venues Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto"></div>
            <p className="text-green-200 mt-4">Loading venues...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : venues.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl">
            <p className="text-green-200 text-lg">No venues found</p>
            <p className="text-green-300/60 mt-2">Venues will be added soon!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 overflow-hidden hover:border-green-500/50 transition"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-white">{venue.name}</h3>
                    {venue.isActive ? (
                      <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">
                        Active
                      </span>
                    ) : (
                      <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full text-xs">
                        Inactive
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm text-green-200">
                    <p className="flex items-center gap-2">
                      📍 {venue.address}
                    </p>
                    {venue.phone && (
                      <p className="flex items-center gap-2">
                        📞 {venue.phone}
                      </p>
                    )}
                    {venue.email && (
                      <p className="flex items-center gap-2">
                        ✉️ {venue.email}
                      </p>
                    )}
                    {venue._count && (
                      <p className="flex items-center gap-2">
                        🃏 {venue._count.events} events hosted
                      </p>
                    )}
                  </div>

                  {venue.description && (
                    <p className="mt-3 text-green-300/70 text-sm line-clamp-2">
                      {venue.description}
                    </p>
                  )}

                  <div className="mt-4">
                    <Link
                      href={`/events?venueId=${venue.id}`}
                      className="block text-center bg-green-600/20 text-green-400 py-2 rounded-lg hover:bg-green-600/30 transition"
                    >
                      View Events at this Venue
                    </Link>
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
