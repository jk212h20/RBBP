'use client';

import { useEffect, useState } from 'react';
import { announcementAPI, type AdminAnnouncement } from '@/lib/api';

interface AnnouncementsTabProps {
  setMessage: (msg: string) => void;
  setError: (msg: string) => void;
}

interface FormState {
  message: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyForm: FormState = { message: '', linkUrl: '', sortOrder: 0, isActive: true };

export default function AnnouncementsTab({ setMessage, setError }: AnnouncementsTabProps) {
  const [items, setItems] = useState<AdminAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await announcementAPI.listAdmin();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await announcementAPI.create({
        message: form.message,
        linkUrl: form.linkUrl || null,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      });
      setMessage('Announcement created!');
      reset();
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to create');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    try {
      setError('');
      await announcementAPI.update(editing.id, {
        message: form.message,
        linkUrl: form.linkUrl || null,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      });
      setMessage('Announcement updated!');
      reset();
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    }
  };

  const startEdit = (a: AdminAnnouncement) => {
    setEditing(a);
    setShowForm(false);
    setForm({
      message: a.message,
      linkUrl: a.linkUrl || '',
      sortOrder: a.sortOrder,
      isActive: a.isActive,
    });
  };

  const handleToggleActive = async (a: AdminAnnouncement) => {
    try {
      setError('');
      await announcementAPI.update(a.id, { isActive: !a.isActive });
      setMessage(`Announcement ${a.isActive ? 'hidden' : 'shown'}.`);
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to update');
    }
  };

  const handleDelete = async (a: AdminAnnouncement) => {
    if (!confirm(`Delete announcement: "${a.message.slice(0, 50)}..."?`)) return;
    try {
      setError('');
      await announcementAPI.delete(a.id);
      setMessage('Announcement deleted.');
      load();
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    }
  };

  const formFields = (
    <>
      <div>
        <label className="block text-gray-400 mb-1">Message *</label>
        <input
          type="text"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          required
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
          placeholder="e.g., 🎉 New season starts March 1 — sign up now!"
        />
      </div>
      <div>
        <label className="block text-gray-400 mb-1">
          Link URL <span className="text-gray-500 text-sm">(optional — makes the text clickable)</span>
        </label>
        <input
          type="text"
          value={form.linkUrl}
          onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
          className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
          placeholder="https://… or /events/abc"
        />
      </div>
      <div className="flex items-center gap-6">
        <div>
          <label className="block text-gray-400 mb-1">Sort Order</label>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
            className="w-32 p-3 bg-gray-700 border border-gray-600 rounded text-white"
          />
        </div>
        <label className="flex items-center gap-2 text-gray-300 mt-6">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            className="w-4 h-4"
          />
          Visible
        </label>
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">📣 Announcement Bar</h2>
          <button
            onClick={() => {
              if (editing) {
                reset();
              } else {
                setShowForm(!showForm);
                setEditing(null);
                setForm({ ...emptyForm, sortOrder: items.length });
              }
            }}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              showForm || editing ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {showForm || editing ? '✕ Cancel' : '➕ New Announcement'}
          </button>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Active announcements appear in a bar directly under the top nav. If the
          combined text fits, it sits still — otherwise it slowly scrolls horizontally.
        </p>

        {showForm && (
          <form onSubmit={handleCreate} className="space-y-4 bg-gray-700/50 rounded-lg p-4 mb-4">
            {formFields}
            <button
              type="submit"
              disabled={!form.message.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-semibold"
            >
              ➕ Create
            </button>
          </form>
        )}

        {editing && (
          <form onSubmit={handleUpdate} className="space-y-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-blue-400">✏️ Editing</h3>
            {formFields}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!form.message.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded font-semibold"
              >
                💾 Save
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          </div>
        ) : items.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No announcements yet. Click "New Announcement" to add one.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <div
                key={a.id}
                className={`bg-gray-700 p-4 rounded border-l-4 ${
                  a.isActive ? 'border-yellow-500' : 'border-gray-500 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-gray-500 text-xs">#{a.sortOrder}</span>
                      {!a.isActive && (
                        <span className="text-xs bg-gray-600 text-gray-300 px-2 py-0.5 rounded">Hidden</span>
                      )}
                    </div>
                    <p className="text-white">{a.message}</p>
                    {a.linkUrl && (
                      <p className="text-blue-300 text-xs mt-1 font-mono truncate">→ {a.linkUrl}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(a)} className="text-blue-400 hover:text-blue-300 text-sm">
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(a)}
                      className={`text-sm ${
                        a.isActive ? 'text-yellow-400 hover:text-yellow-300' : 'text-blue-300 hover:text-blue-200'
                      }`}
                    >
                      {a.isActive ? '👁️ Hide' : '👁️ Show'}
                    </button>
                    <button onClick={() => handleDelete(a)} className="text-red-400 hover:text-red-300 text-sm">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
