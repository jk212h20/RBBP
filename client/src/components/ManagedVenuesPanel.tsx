'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { venuesAPI } from '@/lib/api';
import ImageUpload from './ImageUpload';

type ManagedVenue = {
  id: string;
  name: string;
  address: string;
  description?: string | null;
  imageUrl?: string | null;
  menuUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  _count?: { events: number };
};

type VenueEdit = {
  description: string;
  imageUrl: string | null;
  menuUrl: string;
  menuImage: string | null;
  phone: string;
  email: string;
};

function isMenuImage(value?: string | null) {
  return !!value && value.startsWith('data:image/');
}

export default function ManagedVenuesPanel() {
  const [venues, setVenues] = useState<ManagedVenue[]>([]);
  const [edits, setEdits] = useState<Record<string, VenueEdit>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadVenues();
  }, []);

  const loadVenues = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await venuesAPI.getManaged();
      setVenues(data);
      const nextEdits: Record<string, VenueEdit> = {};
      const nextExpanded: Record<string, boolean> = {};
      data.forEach((venue: ManagedVenue, index: number) => {
        nextEdits[venue.id] = {
          description: venue.description || '',
          imageUrl: venue.imageUrl || null,
          menuUrl: isMenuImage(venue.menuUrl) ? '' : venue.menuUrl || '',
          menuImage: isMenuImage(venue.menuUrl) ? venue.menuUrl || null : null,
          phone: venue.phone || '',
          email: venue.email || '',
        };
        nextExpanded[venue.id] = expanded[venue.id] ?? index === 0;
      });
      setEdits(nextEdits);
      setExpanded(nextExpanded);
    } catch (err: any) {
      setError(err.message || 'Failed to load your venues');
    } finally {
      setLoading(false);
    }
  };

  const saveVenue = async (venueId: string) => {
    const edit = edits[venueId];
    if (!edit) return;

    setSaving(venueId);
    setMessage('');
    setError('');
    try {
      await venuesAPI.update(venueId, {
        description: edit.description,
        imageUrl: edit.imageUrl,
        menuUrl: edit.menuImage || edit.menuUrl || '',
        phone: edit.phone,
        email: edit.email,
      });
      setMessage('Venue profile updated');
      await loadVenues();
    } catch (err: any) {
      setError(err.message || 'Failed to update venue');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="text-gray-400 py-6">Loading your venues...</div>;
  if (venues.length === 0) return null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-white text-xl font-bold mb-2">🏢 My Venue Profiles</h2>
        <p className="text-gray-400 text-sm">Update descriptions, venue photos, menu images/links, and contact info for venues assigned to your account.</p>
      </div>

      {message && <div className="bg-green-900/50 border border-green-600 text-green-200 p-3 rounded-lg">{message}</div>}
      {error && <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded-lg">{error}</div>}

      <div className="space-y-4">
        {venues.map(venue => {
          const edit = edits[venue.id];
          const isOpen = expanded[venue.id] !== false;
          if (!edit) return null;

          return (
            <div key={venue.id} className="bg-gray-800/90 border border-gray-700 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(prev => ({ ...prev, [venue.id]: !isOpen }))}
                className="w-full p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-left hover:bg-gray-700/50 transition"
              >
                <div>
                  <h3 className="text-white font-bold text-lg">{venue.name}</h3>
                  <p className="text-gray-400 text-sm">{venue.address}</p>
                  {venue._count?.events !== undefined && <p className="text-gray-500 text-xs">{venue._count.events} events</p>}
                </div>
                <span className="text-gray-400 text-sm">{isOpen ? '▲ Hide editor' : '▼ Edit profile'}</span>
              </button>

              {isOpen && (
                <div className="p-5 border-t border-gray-700 space-y-5">
                  <div className="flex flex-wrap gap-3">
                    <Link href={`/venues/${venue.id}`} className="text-blue-300 hover:text-blue-200 underline text-sm">
                      View public venue page
                    </Link>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <ImageUpload
                      currentImage={edit.imageUrl}
                      onImageChange={(imageData) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], imageUrl: imageData } }))}
                      label="Venue photo"
                      maxSizeKB={500}
                    />
                    <ImageUpload
                      currentImage={edit.menuImage}
                      onImageChange={(imageData) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], menuImage: imageData, menuUrl: imageData ? '' : prev[venue.id].menuUrl } }))}
                      label="Menu image"
                      maxSizeKB={700}
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1">Description</label>
                    <textarea
                      value={edit.description}
                      onChange={(e) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], description: e.target.value } }))}
                      rows={4}
                      className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white"
                      placeholder="Tell players what makes this venue great..."
                    />
                  </div>

                  <div>
                    <label className="block text-gray-300 mb-1">Menu link optional</label>
                    <input
                      value={edit.menuUrl}
                      onChange={(e) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], menuUrl: e.target.value, menuImage: e.target.value ? null : prev[venue.id].menuImage } }))}
                      className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white"
                      placeholder="https://example.com/menu.pdf"
                    />
                    <p className="text-gray-500 text-xs mt-1">Use either a menu image upload or a menu link/PDF URL.</p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-300 mb-1">Phone</label>
                      <input
                        value={edit.phone}
                        onChange={(e) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], phone: e.target.value } }))}
                        className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-1">Email</label>
                      <input
                        type="email"
                        value={edit.email}
                        onChange={(e) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], email: e.target.value } }))}
                        className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white"
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => saveVenue(venue.id)}
                    disabled={saving === venue.id}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-semibold"
                  >
                    {saving === venue.id ? 'Saving...' : 'Save Venue Profile'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
