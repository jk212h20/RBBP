'use client';

import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';

interface ReferralData {
  id: string;
  name: string;
  createdAt: string;
  checkedIn: boolean;
  rewardPaid: boolean;
}

interface ReferrerData {
  id: string;
  name: string;
  referralCode: string | null;
  referralCount: number;
  checkedInCount: number;
  satsPaid: number;
  referrals: ReferralData[];
}

interface ReferralOverview {
  rewardSats: number;
  totalReferrals: number;
  totalPending: number;
  totalCheckedIn: number;
  totalSatsPaid: number;
  referrers: ReferrerData[];
}

type FilterMode = 'all' | 'pending' | 'checked-in' | 'rewarded';

export default function AdminReferralsTab() {
  const [overview, setOverview] = useState<ReferralOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [expandedReferrers, setExpandedReferrers] = useState<Set<string>>(new Set());

  // Reward settings
  const [editingReward, setEditingReward] = useState(false);
  const [newRewardSats, setNewRewardSats] = useState('');
  const [savingReward, setSavingReward] = useState(false);
  const [rewardMessage, setRewardMessage] = useState<string | null>(null);

  useEffect(() => {
    loadOverview();
  }, []);

  const loadOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminAPI.getReferralOverview();
      setOverview(data);
      setNewRewardSats(data.rewardSats.toString());
    } catch (err: any) {
      setError(err.message || 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveReward = async () => {
    const sats = parseInt(newRewardSats, 10);
    if (isNaN(sats) || sats < 0) {
      setRewardMessage('Please enter a valid non-negative number');
      return;
    }

    try {
      setSavingReward(true);
      setRewardMessage(null);
      const result = await adminAPI.updateReferralSettings(sats);
      setRewardMessage(result.message);
      setEditingReward(false);
      // Reload overview with new reward amount
      await loadOverview();
    } catch (err: any) {
      setRewardMessage(err.message || 'Failed to update reward');
    } finally {
      setSavingReward(false);
    }
  };

  const toggleExpanded = (referrerId: string) => {
    setExpandedReferrers((prev) => {
      const next = new Set(prev);
      if (next.has(referrerId)) {
        next.delete(referrerId);
      } else {
        next.add(referrerId);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!overview) return;
    setExpandedReferrers(new Set(overview.referrers.map((r) => r.id)));
  };

  const collapseAll = () => {
    setExpandedReferrers(new Set());
  };

  // Filter referrals within each referrer
  const getFilteredReferrals = (referrals: ReferralData[]): ReferralData[] => {
    switch (filter) {
      case 'pending':
        return referrals.filter((r) => !r.checkedIn);
      case 'checked-in':
        return referrals.filter((r) => r.checkedIn && !r.rewardPaid);
      case 'rewarded':
        return referrals.filter((r) => r.rewardPaid);
      default:
        return referrals;
    }
  };

  // Get referrers that have at least one referral matching the filter
  const getFilteredReferrers = (): ReferrerData[] => {
    if (!overview) return [];
    return overview.referrers.filter((referrer) => {
      const filtered = getFilteredReferrals(referrer.referrals);
      return filtered.length > 0;
    });
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading referral data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        <button
          onClick={loadOverview}
          className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!overview) return null;

  const filteredReferrers = getFilteredReferrers();

  return (
    <div className="space-y-6">
      {/* Reward Settings */}
      <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">⚡ Referral Reward</h3>
            <p className="text-sm text-gray-600 mt-1">
              Amount credited to referrer when their referred player gets checked in
            </p>
          </div>
          {editingReward ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={newRewardSats}
                onChange={(e) => setNewRewardSats(e.target.value)}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right font-mono"
                min="0"
                step="1000"
              />
              <span className="text-sm text-gray-500">sats</span>
              <button
                onClick={handleSaveReward}
                disabled={savingReward}
                className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 disabled:opacity-50"
              >
                {savingReward ? '...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditingReward(false);
                  setNewRewardSats(overview.rewardSats.toString());
                  setRewardMessage(null);
                }}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-orange-600">
                {overview.rewardSats.toLocaleString()} sats
              </span>
              <button
                onClick={() => setEditingReward(true)}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Edit
              </button>
            </div>
          )}
        </div>
        {rewardMessage && (
          <div className="mt-2 text-sm text-green-600 font-medium">{rewardMessage}</div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          Note: Changes apply to future check-ins only. Restart server or redeploy to persist across restarts.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{overview.totalReferrals}</div>
          <div className="text-xs text-gray-500 mt-1">Total Referrals</div>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{overview.totalPending}</div>
          <div className="text-xs text-gray-500 mt-1">⏳ Pending</div>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{overview.totalCheckedIn}</div>
          <div className="text-xs text-gray-500 mt-1">✅ Checked In</div>
        </div>
        <div className="bg-white border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-500">
            {overview.totalSatsPaid.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">⚡ Sats Paid</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Filter:</span>
        {([
          { key: 'all', label: 'All', count: overview.totalReferrals },
          { key: 'pending', label: '⏳ Pending', count: overview.totalPending },
          { key: 'checked-in', label: '✅ Checked In (Unpaid)', count: overview.totalCheckedIn - overview.referrers.reduce((acc, r) => acc + r.referrals.filter(ref => ref.rewardPaid).length, 0) },
          { key: 'rewarded', label: '💰 Rewarded', count: overview.referrers.reduce((acc, r) => acc + r.referrals.filter(ref => ref.rewardPaid).length, 0) },
        ] as { key: FilterMode; label: string; count: number }[]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f.key
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Referrer List */}
      {filteredReferrers.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          {overview.totalReferrals === 0
            ? 'No referrals yet. Share referral links with players to get started!'
            : 'No referrals match this filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              {filteredReferrers.length} Referrer{filteredReferrers.length !== 1 ? 's' : ''}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                Expand All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={collapseAll}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                Collapse All
              </button>
            </div>
          </div>

          {filteredReferrers.map((referrer) => {
            const filteredReferrals = getFilteredReferrals(referrer.referrals);
            const isExpanded = expandedReferrers.has(referrer.id);

            return (
              <div
                key={referrer.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden"
              >
                {/* Referrer Header */}
                <button
                  onClick={() => toggleExpanded(referrer.id)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className={`transform transition ${isExpanded ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    <div className="text-left">
                      <span className="font-semibold text-gray-900">{referrer.name}</span>
                      {referrer.referralCode && (
                        <span className="ml-2 text-xs text-gray-400 font-mono">
                          ({referrer.referralCode})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-500">
                      {referrer.referralCount} referred
                    </span>
                    <span className="text-green-600 font-medium">
                      {referrer.checkedInCount} checked in
                    </span>
                    {referrer.satsPaid > 0 && (
                      <span className="text-orange-500 font-medium">
                        ⚡ {referrer.satsPaid.toLocaleString()} sats
                      </span>
                    )}
                  </div>
                </button>

                {/* Referrals Table */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">
                            Referred Player
                          </th>
                          <th className="text-left px-4 py-2 text-gray-500 font-medium text-xs">
                            Signed Up
                          </th>
                          <th className="text-center px-4 py-2 text-gray-500 font-medium text-xs">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredReferrals.map((ref) => (
                          <tr
                            key={ref.id}
                            className={
                              ref.rewardPaid
                                ? 'bg-green-50/50'
                                : ref.checkedIn
                                ? 'bg-blue-50/50'
                                : 'bg-amber-50/30'
                            }
                          >
                            <td className="px-4 py-2.5 text-gray-900 font-medium">
                              {ref.name}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">
                              {new Date(ref.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {ref.rewardPaid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  💰 Rewarded
                                </span>
                              ) : ref.checkedIn ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                  ✅ Checked In
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                  ⏳ Awaiting Check-in
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
