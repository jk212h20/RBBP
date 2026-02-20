'use client';

import { useState, useEffect } from 'react';
import { adminAPI, authAPI } from '@/lib/api';

interface NotificationsTabProps {
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
}

interface NotificationPrefs {
  newUser: boolean;
  withdrawal: boolean;
  venueApplication: boolean;
}

const NOTIFICATION_ITEMS: { key: keyof NotificationPrefs; label: string; description: string; emoji: string }[] = [
  {
    key: 'newUser',
    label: 'New Account Created',
    description: 'Receive a notification when a new player registers an account.',
    emoji: '🎉',
  },
  {
    key: 'withdrawal',
    label: 'Withdrawal Processed',
    description: 'Receive a notification when a lightning withdrawal is successfully paid.',
    emoji: '💸',
  },
  {
    key: 'venueApplication',
    label: 'Venue Application Submitted',
    description: 'Receive a notification when a new venue application comes in.',
    emoji: '🏢',
  },
];

export default function NotificationsTab({ setMessage, setError }: NotificationsTabProps) {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    newUser: true,
    withdrawal: true,
    venueApplication: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Telegram status
  const [telegramUsername, setTelegramUsername] = useState<string>('');
  const [telegramVerified, setTelegramVerified] = useState(false);
  const [verifyingTelegram, setVerifyingTelegram] = useState(false);

  useEffect(() => {
    loadPrefs();
    loadTelegramStatus();
  }, []);

  async function loadPrefs() {
    try {
      setLoading(true);
      const data = await adminAPI.getNotificationPrefs();
      setPrefs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  }

  async function loadTelegramStatus() {
    try {
      const data = await authAPI.getProfileDetails();
      setTelegramUsername(data.profile?.telegramUsername || '');
      setTelegramVerified(data.profile?.telegramVerified ?? false);
    } catch {
      // Non-critical — ignore errors
    }
  }

  async function handleVerifyTelegram() {
    setVerifyingTelegram(true);
    try {
      const result = await authAPI.verifyTelegram();
      if (result.success) {
        setMessage(result.message || 'Check your Telegram — a verification message was sent!');
        await loadTelegramStatus();
      } else {
        setError(result.error || "Verification failed. Make sure you've messaged the bot first.");
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setVerifyingTelegram(false);
    }
  }

  async function handleToggle(key: keyof NotificationPrefs) {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(true);
    try {
      const updated = await adminAPI.updateNotificationPrefs(newPrefs);
      setPrefs(updated);
      setMessage('Notification preferences saved');
    } catch (err: any) {
      // Revert on error
      setPrefs(prefs);
      setError(err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        Loading notification preferences…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Telegram Notifications</h2>
        <p className="text-sm text-gray-400">
          Choose which events you want to be notified about via Telegram. Notifications are sent to the Telegram username set in your{' '}
          <a href="/profile" className="text-blue-400 hover:underline">profile</a>.
          {' '}Each admin manages their own preferences independently.
        </p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
        {NOTIFICATION_ITEMS.map(({ key, label, description, emoji }) => (
          <div key={key} className="flex items-center justify-between px-5 py-4 gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">{emoji}</span>
              <div>
                <p className="text-white font-medium text-sm">{label}</p>
                <p className="text-gray-400 text-xs mt-0.5">{description}</p>
              </div>
            </div>
            <button
              onClick={() => handleToggle(key)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                prefs[key] ? 'bg-blue-600' : 'bg-gray-600'
              } disabled:opacity-50`}
              role="switch"
              aria-checked={prefs[key]}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  prefs[key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* Telegram status for this admin */}
      {telegramUsername ? (
        <div className={`rounded-lg border p-4 ${telegramVerified ? 'bg-green-900/20 border-green-700/40' : 'bg-yellow-900/20 border-yellow-600/40'}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className={`text-sm font-medium ${telegramVerified ? 'text-green-300' : 'text-yellow-300'}`}>
                {telegramVerified ? '✅ Telegram Verified' : '⚠️ Telegram Not Verified'}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                @{telegramUsername}
                {!telegramVerified && ' — notifications cannot be sent until verified'}
              </p>
            </div>
            {!telegramVerified && (
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'RoatanPokerBot'}?start=verify`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                >
                  1️⃣ Message the Bot
                </a>
                <button
                  onClick={handleVerifyTelegram}
                  disabled={verifyingTelegram}
                  className="inline-flex items-center gap-1 bg-green-600/20 hover:bg-green-600/30 disabled:opacity-50 text-green-300 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                >
                  {verifyingTelegram ? '⏳ Verifying…' : '2️⃣ Verify Now'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-yellow-700/30 rounded-lg p-4 text-sm text-yellow-300/80">
          <p className="font-medium mb-1">⚠️ No Telegram username set</p>
          <p className="text-gray-400 text-xs">
            Go to your <a href="/profile" className="text-blue-400 hover:underline">profile</a> and add your Telegram username to receive notifications.
          </p>
        </div>
      )}

      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-sm text-gray-400">
        <p className="font-medium text-gray-300 mb-1">📌 How it works</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Notifications are sent to your Telegram username via the poker bot.</li>
          <li>You must <strong className="text-gray-300">message the bot first</strong> on Telegram before it can DM you.</li>
          <li>Set your Telegram username in <a href="/profile" className="text-blue-400 hover:underline">your profile</a> (without the @).</li>
          <li>Multiple admins can each configure their own notification preferences independently.</li>
        </ul>
      </div>
    </div>
  );
}
