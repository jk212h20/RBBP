'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
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
    <div className="min-h-screen ">
      <MobileNav currentPage="venues" />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">📍 Poker Venues</h1>
            <p className="text-blue-100">Find poker nights at venues across Roatan</p>
          </div>
          <Link
            href="/venues/apply"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition text-center whitespace-nowrap"
          >
            🏢 Apply to Add Venue
          </Link>
        </div>

        {/* Venues Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-blue-100 mt-4">Loading venues...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : venues.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl">
            <p className="text-blue-100 text-lg">No venues found</p>
            <p className="text-blue-200/60 mt-2">Venues will be added soon!</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <div
                key={venue.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 overflow-hidden hover:border-blue-500/50 transition"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-white">{venue.name}</h3>
                    {venue.isActive ? (
                      <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs">
                        Active
                      </span>
                    ) : (
                      <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full text-xs">
                        Inactive
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm text-blue-100">
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
                    <p className="mt-3 text-blue-200/70 text-sm line-clamp-2">
                      {venue.description}
                    </p>
                  )}

                  <div className="mt-4">
                    <Link
                      href={`/events?venueId=${venue.id}`}
                      className="block text-center bg-blue-600/20 text-blue-300 py-2 rounded-lg hover:bg-blue-600/30 transition"
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
