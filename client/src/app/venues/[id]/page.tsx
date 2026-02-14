'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { venuesAPI, eventsAPI } from '@/lib/api';

interface Venue {
  id: string;
  name: string;
  address: string;
  description: string | null;
  imageUrl: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  manager?: { id: string; name: string } | null;
}

interface Event {
  id: string;
  name: string;
  dateTime: string;
  status: string;
  maxPlayers: number;
  buyIn: number | null;
  _count: { signups: number };
}

export default function VenueDetailPage() {
  const params = useParams();
  const venueId = params.id as string;
  
  const [venue, setVenue] = useState<Venue | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (venueId) {
      loadVenue();
      loadEvents();
    }
  }, [venueId]);

  const loadVenue = async () => {
    try {
      const data = await venuesAPI.getById(venueId);
      setVenue(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load venue');
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const allEvents = await eventsAPI.getAll();
      const venueEvents = allEvents.filter((e: any) => e.venue?.id === venueId || e.venueId === venueId);
      setEvents(venueEvents);
    } catch (err) {
      console.error('Failed to load events:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  if (error || !venue) {
    return (
      <div className="min-h-screen  text-white p-8">
        <div className="max-w-4xl mx-auto">
          <Link href="/venues" className="text-blue-300 hover:text-blue-200 mb-8 inline-block">
            ← Back to Venues
          </Link>
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-6 rounded-lg text-center">
            <h1 className="text-2xl font-bold mb-2">Venue Not Found</h1>
            <p>{error || 'The venue you are looking for does not exist.'}</p>
          </div>
        </div>
      </div>
    );
  }

  const upcomingEvents = events.filter(e => new Date(e.dateTime) > new Date() && e.status !== 'CANCELLED');
  const pastEvents = events.filter(e => new Date(e.dateTime) <= new Date() || e.status === 'COMPLETED');

  return (
    <div className="min-h-screen  text-white">
      {/* Header */}
      <header className="bg-black/30 border-b border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <Link href="/venues" className="text-blue-300 hover:text-blue-200">
            ← Back to Venues
          </Link>
          <Link href="/dashboard" className="text-white/70 hover:text-white">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-8">
        {/* Venue Header - Side by side layout */}
        <div className="bg-white/10 backdrop-blur rounded-2xl overflow-hidden mb-8">
          <div className={`flex flex-col ${venue.imageUrl ? 'md:flex-row' : ''}`}>
            {/* Image - Full display, not cropped */}
            {venue.imageUrl && (
              <div className="md:w-1/2 bg-gray-800 flex items-center justify-center p-4">
                <img 
                  src={venue.imageUrl} 
                  alt={venue.name}
                  className="max-w-full max-h-80 object-contain rounded-lg"
                />
              </div>
            )}
            
            {/* Details */}
            <div className={`p-6 ${venue.imageUrl ? 'md:w-1/2' : 'w-full'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{venue.name}</h1>
                  <p className="text-blue-300 flex items-center gap-2">
                    📍 {venue.address}
                  </p>
                </div>
                {venue.isActive ? (
                  <span className="bg-blue-600/30 text-blue-300 px-3 py-1 rounded-full text-sm">
                    Active
                  </span>
                ) : (
                  <span className="bg-red-600/30 text-red-400 px-3 py-1 rounded-full text-sm">
                    Inactive
                  </span>
                )}
              </div>
              
              {venue.description && (
                <p className="text-gray-300 mb-4">{venue.description}</p>
              )}

              <div className="flex flex-wrap gap-4">
                {venue.phone && (
                  <a href={`tel:${venue.phone}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                    📞 {venue.phone}
                  </a>
                )}
                {venue.email && (
                  <a href={`mailto:${venue.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300">
                    ✉️ {venue.email}
                  </a>
                )}
                {venue.manager && (
                  <span className="flex items-center gap-2 text-gray-400">
                    👤 Manager: {venue.manager.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-300">{events.length}</p>
            <p className="text-gray-400 text-sm">Total Events</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{upcomingEvents.length}</p>
            <p className="text-gray-400 text-sm">Upcoming</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-400">{pastEvents.length}</p>
            <p className="text-gray-400 text-sm">Completed</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">
              {events.reduce((sum, e) => sum + (e._count?.signups || 0), 0)}
            </p>
            <p className="text-gray-400 text-sm">Total Signups</p>
          </div>
        </div>

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              📅 Upcoming Events
            </h2>
            <div className="space-y-3">
              {upcomingEvents.map(event => (
                <Link 
                  key={event.id} 
                  href={`/events/${event.id}`}
                  className="block bg-white/10 backdrop-blur rounded-xl p-4 hover:bg-white/20 transition"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{event.name}</h3>
                      <p className="text-gray-400 text-sm">
                        📆 {new Date(event.dateTime).toLocaleDateString()} at {new Date(event.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                      <p className="text-gray-500 text-xs mt-1">
                        {event._count?.signups || 0}/{event.maxPlayers} players
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Past Events */}
        {pastEvents.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🏆 Past Events
            </h2>
            <div className="space-y-3">
              {pastEvents.slice(0, 5).map(event => (
                <Link 
                  key={event.id} 
                  href={`/events/${event.id}`}
                  className="block bg-white/5 backdrop-blur rounded-xl p-4 hover:bg-white/10 transition"
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{event.name}</h3>
                      <p className="text-gray-500 text-sm">
                        📆 {new Date(event.dateTime).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-blue-300 text-sm">✅ Completed</span>
                      <p className="text-gray-500 text-xs">{event._count?.signups || 0} players</p>
                    </div>
                  </div>
                </Link>
              ))}
              {pastEvents.length > 5 && (
                <p className="text-gray-500 text-center text-sm">
                  + {pastEvents.length - 5} more events
                </p>
              )}
            </div>
          </div>
        )}

        {events.length === 0 && (
          <div className="bg-white/5 backdrop-blur rounded-xl p-8 text-center">
            <p className="text-gray-400">No events at this venue yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
