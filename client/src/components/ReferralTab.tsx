'use client';

import { useState, useEffect } from 'react';
import { referralAPI } from '@/lib/api';

const REWARD_SATS = 10_000; // Must match server REFERRAL_REWARD_SATS

interface ReferralStats {
  referralCode: string;
  totalReferred: number;
  totalCheckedIn: number;
  totalSatsEarned: number;
  referrals: {
    id: string;
    name: string;
    createdAt: string;
    checkedIn: boolean;
    rewardPaid: boolean;
  }[];
}

export default function ReferralTab() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await referralAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load referral stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const referralUrl = stats
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${stats.referralCode}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading referral info...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-red-500">
        Failed to load referral info.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Referral Link */}
      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-5">
        <h3 className="text-lg font-bold text-gray-900 mb-1">🔗 Your Referral Link</h3>
        <p className="text-sm text-gray-600 mb-3">
          Share this link with friends. When they sign up and get checked in at their first event, you earn <strong>{REWARD_SATS.toLocaleString()} sats</strong>!
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            readOnly
            value={referralUrl}
            className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 font-mono"
            onClick={(e) => (e.target as HTMLInputElement).select()}
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 transition whitespace-nowrap"
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{stats.totalReferred}</div>
          <div className="text-xs text-gray-500 mt-1">Referred</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.totalCheckedIn}</div>
          <div className="text-xs text-gray-500 mt-1">Checked In</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">{stats.totalSatsEarned.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">Sats Earned</div>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <h4 className="font-semibold text-gray-900 mb-3">How It Works</h4>
        <ol className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
            <span>Share your referral link with a friend</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
            <span>They create an account using your link</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-blue-100 text-blue-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
            <span>They attend an event and get checked in by the TD</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-green-100 text-green-700 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
            <span><strong>{REWARD_SATS.toLocaleString()} sats</strong> are added to your Lightning balance!</span>
          </li>
        </ol>
      </div>

      {/* Referral List */}
      {stats.referrals.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Your Referrals</h4>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-600 font-medium">Name</th>
                  <th className="text-left px-4 py-2 text-gray-600 font-medium">Joined</th>
                  <th className="text-center px-4 py-2 text-gray-600 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.referrals.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.rewardPaid ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          ✅ Rewarded
                        </span>
                      ) : r.checkedIn ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 text-xs font-medium">
                          ☑️ Checked in
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-medium">
                          ⏳ Awaiting check-in
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
