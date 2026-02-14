'use client';

import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? `https://${window.location.hostname.replace('client', 'server')}/api`
    : 'http://localhost:3001/api');

interface ExportOption {
  key: string;
  label: string;
  icon: string;
  description: string;
  endpoint: string;
}

const EXPORTS: ExportOption[] = [
  {
    key: 'users',
    label: 'Users & Emails',
    icon: '👥',
    description: 'All users with name, email, role, auth provider, status, season points, and join date.',
    endpoint: '/admin/export/users',
  },
  {
    key: 'standings',
    label: 'Leaderboard / Standings',
    icon: '🏆',
    description: 'Current season standings: rank, player, email, total points, events played, wins, top 3s, knockouts.',
    endpoint: '/admin/export/standings',
  },
  {
    key: 'events',
    label: 'Events',
    icon: '📅',
    description: 'All events with name, date, venue, season, status, signup count, results count, max players, buy-in.',
    endpoint: '/admin/export/events',
  },
  {
    key: 'results',
    label: 'Event Results',
    icon: '📊',
    description: 'All event results: event name, date, player, position, knockouts, points earned.',
    endpoint: '/admin/export/results',
  },
  {
    key: 'signups',
    label: 'Event Signups',
    icon: '📝',
    description: 'All signups: event, date, player, email, status, registered at, checked in at.',
    endpoint: '/admin/export/signups',
  },
  {
    key: 'withdrawals',
    label: 'Withdrawals',
    icon: '💰',
    description: 'All Lightning withdrawals: user, email, amount (sats), status, created, paid at.',
    endpoint: '/admin/export/withdrawals',
  },
  {
    key: 'points-history',
    label: 'Points History',
    icon: '📜',
    description: 'Full points audit trail: player, email, season, points, reason, date.',
    endpoint: '/admin/export/points-history',
  },
];

interface ExportsTabProps {
  setMessage: (msg: string) => void;
  setError: (msg: string) => void;
}

export default function ExportsTab({ setMessage, setError }: ExportsTabProps) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleDownload = async (exp: ExportOption) => {
    setDownloading(exp.key);
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}${exp.endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(data.error || 'Download failed');
      }

      // Get filename from Content-Disposition header or generate one
      const disposition = response.headers.get('Content-Disposition');
      let filename = `${exp.key}-${new Date().toISOString().split('T')[0]}.csv`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setMessage(`✅ Downloaded ${exp.label} export as ${filename}`);
    } catch (err: any) {
      setError(err.message || `Failed to download ${exp.label}`);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold mb-2">📥 Data Exports</h2>
      <p className="text-gray-400 text-sm mb-6">
        Download CSV files of your database tables. Files include today's date in the filename.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {EXPORTS.map((exp) => (
          <div
            key={exp.key}
            className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 flex flex-col justify-between hover:border-green-500/50 transition"
          >
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{exp.icon}</span>
                <h3 className="font-semibold text-white">{exp.label}</h3>
              </div>
              <p className="text-gray-400 text-xs mb-4">{exp.description}</p>
            </div>
            <button
              onClick={() => handleDownload(exp)}
              disabled={downloading !== null}
              className={`w-full py-2 rounded font-semibold text-sm transition ${
                downloading === exp.key
                  ? 'bg-green-600/50 text-green-300 cursor-wait'
                  : downloading !== null
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {downloading === exp.key ? '⏳ Downloading...' : '⬇️ Download CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
