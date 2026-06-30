'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { venueMediaAPI, venuesAPI } from '@/lib/api';
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
  phone: string;
  email: string;
};

type VenueMedia = {
  id: string;
  venueId: string;
  imageUrl: string;
  caption?: string | null;
  isMenu: boolean;
  sortOrder: number;
  createdAt: string;
};

type NewMedia = {
  imageUrl: string | null;
  caption: string;
  isMenu: boolean;
  sortOrder: string;
};

const emptyNewMedia: NewMedia = { imageUrl: null, caption: '', isMenu: false, sortOrder: '' };

function isMenuImage(value?: string | null) {
  return !!value && value.startsWith('data:image/');
}

export default function ManagedVenuesPanel() {
  const [venues, setVenues] = useState<ManagedVenue[]>([]);
  const [edits, setEdits] = useState<Record<string, VenueEdit>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [mediaByVenue, setMediaByVenue] = useState<Record<string, VenueMedia[]>>({});
  const [newMediaByVenue, setNewMediaByVenue] = useState<Record<string, NewMedia>>({});
  const [editingMedia, setEditingMedia] = useState<Record<string, { caption: string; isMenu: boolean; sortOrder: string }>>({});
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
      const nextNewMedia: Record<string, NewMedia> = {};
      data.forEach((venue: ManagedVenue, index: number) => {
        nextEdits[venue.id] = {
          description: venue.description || '',
          imageUrl: venue.imageUrl || null,
          menuUrl: isMenuImage(venue.menuUrl) ? '' : venue.menuUrl || '',
          phone: venue.phone || '',
          email: venue.email || '',
        };
        nextExpanded[venue.id] = expanded[venue.id] ?? index === 0;
        nextNewMedia[venue.id] = { ...emptyNewMedia };
      });
      setEdits(nextEdits);
      setExpanded(nextExpanded);
      setNewMediaByVenue(nextNewMedia);

      const mediaEntries = await Promise.all(
        data.map(async (venue: ManagedVenue) => {
          const result = await venueMediaAPI.list(venue.id);
          return [venue.id, result.media] as const;
        })
      );
      const nextMedia: Record<string, VenueMedia[]> = {};
      const nextEditingMedia: Record<string, { caption: string; isMenu: boolean; sortOrder: string }> = {};
      mediaEntries.forEach(([venueId, media]) => {
        nextMedia[venueId] = media;
        media.forEach((item: VenueMedia) => {
          nextEditingMedia[item.id] = {
            caption: item.caption || '',
            isMenu: item.isMenu,
            sortOrder: String(item.sortOrder ?? 0),
          };
        });
      });
      setMediaByVenue(nextMedia);
      setEditingMedia(nextEditingMedia);
    } catch (err: any) {
      setError(err.message || 'Failed to load your venues');
    } finally {
      setLoading(false);
    }
  };

  const saveVenue = async (venueId: string) => {
    const edit = edits[venueId];
    if (!edit) return;

    setSaving(`venue:${venueId}`);
    setMessage('');
    setError('');
    try {
      await venuesAPI.update(venueId, {
        description: edit.description,
        imageUrl: edit.imageUrl,
        menuUrl: edit.menuUrl || '',
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

  const addMedia = async (venueId: string) => {
    const media = newMediaByVenue[venueId];
    if (!media?.imageUrl) {
      setError('Upload an image before adding it');
      return;
    }

    setSaving(`media:${venueId}`);
    setMessage('');
    setError('');
    try {
      await venueMediaAPI.create(venueId, {
        imageUrl: media.imageUrl,
        caption: media.caption || null,
        isMenu: media.isMenu,
        sortOrder: media.sortOrder ? parseInt(media.sortOrder, 10) : undefined,
      });
      setMessage(media.isMenu ? 'Menu image added' : 'Venue photo added');
      await loadVenues();
    } catch (err: any) {
      setError(err.message || 'Failed to add image');
    } finally {
      setSaving(null);
    }
  };

  const saveMedia = async (mediaId: string) => {
    const edit = editingMedia[mediaId];
    if (!edit) return;
    setSaving(`mediaItem:${mediaId}`);
    setMessage('');
    setError('');
    try {
      await venueMediaAPI.update(mediaId, {
        caption: edit.caption || null,
        isMenu: edit.isMenu,
        sortOrder: edit.sortOrder ? parseInt(edit.sortOrder, 10) : 0,
      });
      setMessage('Image updated');
      await loadVenues();
    } catch (err: any) {
      setError(err.message || 'Failed to update image');
    } finally {
      setSaving(null);
    }
  };

  const deleteMedia = async (mediaId: string) => {
    if (!confirm('Delete this image?')) return;
    setSaving(`mediaItem:${mediaId}`);
    setMessage('');
    setError('');
    try {
      await venueMediaAPI.delete(mediaId);
      setMessage('Image deleted');
      await loadVenues();
    } catch (err: any) {
      setError(err.message || 'Failed to delete image');
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
        <p className="text-gray-400 text-sm">Update descriptions, venue photos, menu images, menu links, and contact info for venues assigned to your account.</p>
      </div>

      {message && <div className="bg-green-900/50 border border-green-600 text-green-200 p-3 rounded-lg">{message}</div>}
      {error && <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded-lg">{error}</div>}

      <div className="space-y-4">
        {venues.map(venue => {
          const edit = edits[venue.id];
          const isOpen = expanded[venue.id] !== false;
          const venueMedia = mediaByVenue[venue.id] || [];
          const photos = venueMedia.filter(item => !item.isMenu);
          const menus = venueMedia.filter(item => item.isMenu);
          const newMedia = newMediaByVenue[venue.id] || emptyNewMedia;
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
                <div className="p-5 border-t border-gray-700 space-y-6">
                  <Link href={`/venues/${venue.id}`} className="text-blue-300 hover:text-blue-200 underline text-sm">
                    View public venue page
                  </Link>

                  <div className="grid md:grid-cols-2 gap-5">
                    <ImageUpload
                      currentImage={edit.imageUrl}
                      onImageChange={(imageData) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], imageUrl: imageData } }))}
                      label="Hero venue photo"
                      maxSizeKB={500}
                    />
                    <div className="space-y-4">
                      <div>
                        <label className="block text-gray-300 mb-1">Description</label>
                        <textarea
                          value={edit.description}
                          onChange={(e) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], description: e.target.value } }))}
                          rows={5}
                          className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white"
                          placeholder="Tell players what makes this venue great..."
                        />
                      </div>
                      <div>
                        <label className="block text-gray-300 mb-1">External menu link optional</label>
                        <input
                          value={edit.menuUrl}
                          onChange={(e) => setEdits(prev => ({ ...prev, [venue.id]: { ...prev[venue.id], menuUrl: e.target.value } }))}
                          className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white"
                          placeholder="https://example.com/menu.pdf"
                        />
                        <p className="text-gray-500 text-xs mt-1">Use this for an external PDF/website menu. Use tagged uploads below for menu photos/pages.</p>
                      </div>
                    </div>
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
                    disabled={saving === `venue:${venue.id}`}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-semibold"
                  >
                    {saving === `venue:${venue.id}` ? 'Saving...' : 'Save Venue Profile'}
                  </button>

                  <div className="border-t border-gray-700 pt-6 space-y-5">
                    <div>
                      <h4 className="text-white font-bold text-lg">Photos & Menu Images</h4>
                      <p className="text-gray-400 text-sm">Upload one image at a time. Check “Is menu” for menu pages/photos so they display under the Menu section.</p>
                    </div>

                    <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 grid md:grid-cols-[260px_1fr] gap-4 items-start">
                      <ImageUpload
                        currentImage={newMedia.imageUrl}
                        onImageChange={(imageData) => setNewMediaByVenue(prev => ({ ...prev, [venue.id]: { ...(prev[venue.id] || emptyNewMedia), imageUrl: imageData } }))}
                        label="Upload photo/menu image"
                        maxSizeKB={700}
                      />
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-300 mb-1">Caption optional</label>
                          <input
                            value={newMedia.caption}
                            onChange={(e) => setNewMediaByVenue(prev => ({ ...prev, [venue.id]: { ...(prev[venue.id] || emptyNewMedia), caption: e.target.value } }))}
                            className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white"
                            placeholder="Menu page 1 / patio / bar photo"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4 items-end">
                          <label className="flex items-center gap-2 text-gray-200">
                            <input
                              type="checkbox"
                              checked={newMedia.isMenu}
                              onChange={(e) => setNewMediaByVenue(prev => ({ ...prev, [venue.id]: { ...(prev[venue.id] || emptyNewMedia), isMenu: e.target.checked } }))}
                            />
                            Is menu
                          </label>
                          <div>
                            <label className="block text-gray-300 mb-1">Sort</label>
                            <input
                              type="number"
                              value={newMedia.sortOrder}
                              onChange={(e) => setNewMediaByVenue(prev => ({ ...prev, [venue.id]: { ...(prev[venue.id] || emptyNewMedia), sortOrder: e.target.value } }))}
                              className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-white"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => addMedia(venue.id)}
                          disabled={saving === `media:${venue.id}` || !newMedia.imageUrl}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-semibold"
                        >
                          {saving === `media:${venue.id}` ? 'Adding...' : 'Add Image'}
                        </button>
                      </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-5">
                      <MediaList
                        title={`Venue Photos (${photos.length})`}
                        items={photos}
                        editingMedia={editingMedia}
                        setEditingMedia={setEditingMedia}
                        saveMedia={saveMedia}
                        deleteMedia={deleteMedia}
                        saving={saving}
                      />
                      <MediaList
                        title={`Menu Images (${menus.length})`}
                        items={menus}
                        editingMedia={editingMedia}
                        setEditingMedia={setEditingMedia}
                        saveMedia={saveMedia}
                        deleteMedia={deleteMedia}
                        saving={saving}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MediaList({
  title,
  items,
  editingMedia,
  setEditingMedia,
  saveMedia,
  deleteMedia,
  saving,
}: {
  title: string;
  items: VenueMedia[];
  editingMedia: Record<string, { caption: string; isMenu: boolean; sortOrder: string }>;
  setEditingMedia: Dispatch<SetStateAction<Record<string, { caption: string; isMenu: boolean; sortOrder: string }>>>;
  saveMedia: (mediaId: string) => void;
  deleteMedia: (mediaId: string) => void;
  saving: string | null;
}) {
  return (
    <div className="space-y-3">
      <h5 className="font-semibold text-gray-200">{title}</h5>
      {items.length === 0 ? (
        <div className="text-gray-500 text-sm bg-gray-900/50 rounded-lg p-4">No images yet.</div>
      ) : items.map(item => {
        const edit = editingMedia[item.id];
        if (!edit) return null;
        return (
          <div key={item.id} className="bg-gray-900/70 border border-gray-700 rounded-lg p-3 space-y-3">
            <img src={item.imageUrl} alt={item.caption || 'Venue media'} className="w-full h-44 object-contain rounded bg-black/30" />
            <div>
              <label className="block text-xs text-gray-400 mb-1">Caption</label>
              <input
                value={edit.caption}
                onChange={(e) => setEditingMedia(prev => ({ ...prev, [item.id]: { ...prev[item.id], caption: e.target.value } }))}
                className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={edit.isMenu}
                  onChange={(e) => setEditingMedia(prev => ({ ...prev, [item.id]: { ...prev[item.id], isMenu: e.target.checked } }))}
                />
                Is menu
              </label>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Sort</label>
                <input
                  type="number"
                  value={edit.sortOrder}
                  onChange={(e) => setEditingMedia(prev => ({ ...prev, [item.id]: { ...prev[item.id], sortOrder: e.target.value } }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => saveMedia(item.id)} disabled={saving === `mediaItem:${item.id}`} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm">
                Save
              </button>
              <button onClick={() => deleteMedia(item.id)} disabled={saving === `mediaItem:${item.id}`} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3 py-2 rounded text-sm">
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
