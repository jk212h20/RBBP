'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { sideBetsAPI } from '@/lib/api';

interface SideBetAdmin {
  id: string;
  label: string;
  description: string | null;
  creator: { id: string; name: string };
  event: { id: string; name: string } | null;
  winner: { id: string; name: string } | null;
  entrySats: number;
  feePct: number;
  status: 'OPEN' | 'SETTLED' | 'CANCELLED';
  entryCount: number;
  participantCount: number;
  totalPot: number;
  createdAt: string;
  settledAt: string | null;
  participants: { userId: string; userName: string; entryCount: number }[];
}

export default function AdminSideBetsTab() {
  const [bets, setBets] = useState<SideBetAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState<'all' | 'OPEN' | 'SETTLED' | 'CANCELLED'>('all');
  const [expandedBet, setExpandedBet] = useState<string | null>(null);
  const [settleWinner, setSettleWinner] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fee settings
  const [feePct, setFeePct] = useState<number>(0);
  const [feeInput, setFeeInput] = useState('0');
  const [feeLoading, setFeeLoading] = useState(false);

  const loadBets = async () => {
    try {
      const data = await sideBetsAPI.adminListAll();
      setBets(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load side bets');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const { feePct: pct } = await sideBetsAPI.getSettings();
      setFeePct(pct);
      setFeeInput(String(pct));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadBets();
    loadSettings();
  }, []);

  const handleSettle = async (betId: string) => {
    const winnerId = settleWinner[betId];
    if (!winnerId) return;
    setActionLoading(betId);
    setError('');
    try {
      const result = await sideBetsAPI.adminSettle(betId, winnerId);
      setSuccess(result.message);
      loadBets();
    } catch (err: any) {
      setError(err.message || 'Failed to settle');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (betId: string) => {
    if (!confirm('Cancel this bet and refund all entries?')) return;
    setActionLoading(betId);
    setError('');
    try {
      const result = await sideBetsAPI.adminCancel(betId);
      setSuccess(result.message);
      loadBets();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateFee = async () => {
    const val = parseFloat(feeInput);
    if (isNaN(val) || val < 0 || val > 50) {
      setError('Fee must be between 0 and 50%');
      return;
    }
    setFeeLoading(true);
    try {
      await sideBetsAPI.updateSettings(val);
      setFeePct(val);
      setSuccess(`Fee updated to ${val}%`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFeeLoading(false);
    }
  };

  const filtered = filter === 'all' ? bets : bets.filter(b => b.status === filter);

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  const statusCounts = {
    OPEN: bets.filter(b => b.status === 'OPEN').length,
    SETTLED: bets.filter(b => b.status === 'SETTLED').length,
    CANCELLED: bets.filter(b => b.status === 'CANCELLED').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}
      {success && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 text-green-300 text-sm">
          {success}
          <button onClick={() => setSuccess('')} className="ml-2 text-green-400 hover:text-green-200">✕</button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/10 rounded-lg p-4 text-center border border-white/10">
          <p className="text-2xl font-bold text-white">{bets.length}</p>
          <p className="text-blue-200 text-xs">Total Bets</p>
        </div>
        <div className="bg-green-500/10 rounded-lg p-4 text-center border border-green-500/20">
          <p className="text-2xl font-bold text-green-300">{statusCounts.OPEN}</p>
          <p className="text-green-200 text-xs">Open</p>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4 text-center border border-blue-500/20">
          <p className="text-2xl font-bold text-blue-300">{statusCounts.SETTLED}</p>
          <p className="text-blue-200 text-xs">Settled</p>
        </div>
        <div className="bg-yellow-500/10 rounded-lg p-4 text-center border border-yellow-500/20">
          <p className="text-2xl font-bold text-yellow-300">
            ⚡ {bets.reduce((s, b) => s + b.totalPot, 0).toLocaleString()}
          </p>
          <p className="text-yellow-200 text-xs">Total Sats in Pools</p>
        </div>
      </div>

      {/* Fee Settings */}
      <div className="bg-white/10 rounded-lg p-4 border border-white/10">
        <h3 className="text-white font-bold text-sm mb-2">⚙️ Platform Fee</h3>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={feeInput}
            onChange={e => setFeeInput(e.target.value)}
            className="w-20 p-2 bg-white/10 border border-blue-600/50 rounded text-white text-sm"
            min="0"
            max="50"
            step="0.5"
          />
          <span className="text-blue-200 text-sm">% of pot on settle</span>
          {feeInput !== String(feePct) && (
            <button
              onClick={handleUpdateFee}
              disabled={feeLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
            >
              {feeLoading ? '...' : 'Save'}
            </button>
          )}
          <span className="text-blue-300/60 text-xs ml-auto">Current: {feePct}%</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'OPEN', 'SETTLED', 'CANCELLED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-blue-200 hover:bg-white/20'
            }`}
          >
            {f === 'all' ? `All (${bets.length})` : `${f} (${statusCounts[f]})`}
          </button>
        ))}
      </div>

      {/* Bets List */}
      {filtered.length === 0 ? (
        <p className="text-blue-300 text-center py-8">No side bets found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(bet => {
            const isExpanded = expandedBet === bet.id;
            const isActioning = actionLoading === bet.id;

            return (
              <div key={bet.id} className="bg-white/10 rounded-lg border border-white/10 overflow-hidden">
                {/* Header Row */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/5 transition"
                  onClick={() => setExpandedBet(isExpanded ? null : bet.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        bet.status === 'OPEN' ? 'bg-green-500/20 text-green-300' :
                        bet.status === 'SETTLED' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-red-500/20 text-red-300'
                      }`}>
                        {bet.status}
                      </span>
                      <div className="min-w-0">
                        <p className="text-white font-medium text-sm truncate">{bet.label}</p>
                        <p className="text-blue-300/60 text-xs">
                          by {bet.creator.name} · {formatDate(bet.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-right shrink-0">
                      <div>
                        <p className="text-yellow-300 font-bold text-sm">⚡ {bet.totalPot.toLocaleString()}</p>
                        <p className="text-blue-300/60 text-xs">
                          {bet.participantCount} player{bet.participantCount !== 1 ? 's' : ''} · {bet.entryCount} entr{bet.entryCount !== 1 ? 'ies' : 'y'}
                        </p>
                      </div>
                      <span className="text-blue-300/40 text-sm">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-white/10 p-4 space-y-3">
                    {/* Info row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <span className="text-blue-300/60">Entry:</span>{' '}
                        <span className="text-white">⚡ {bet.entrySats.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-blue-300/60">Fee:</span>{' '}
                        <span className="text-white">{bet.feePct}%</span>
                      </div>
                      {bet.event && (
                        <div>
                          <span className="text-blue-300/60">Event:</span>{' '}
                          <Link href={`/events/${bet.event.id}`} className="text-blue-200 hover:underline">{bet.event.name}</Link>
                        </div>
                      )}
                      {bet.winner && (
                        <div>
                          <span className="text-blue-300/60">Winner:</span>{' '}
                          <span className="text-yellow-300 font-medium">🏆 {bet.winner.name}</span>
                        </div>
                      )}
                    </div>
                    {bet.description && (
                      <p className="text-blue-200/70 text-xs">{bet.description}</p>
                    )}

                    {/* Participants */}
                    <div>
                      <h4 className="text-white text-xs font-bold mb-1">Participants</h4>
                      {bet.participants.length === 0 ? (
                        <p className="text-blue-300/60 text-xs">No paid entries yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {bet.participants.map(p => (
                            <span key={p.userId} className="bg-white/5 px-2 py-0.5 rounded text-xs text-white">
                              {p.userName}
                              {p.entryCount > 1 && (
                                <span className="text-blue-300 ml-1">×{p.entryCount}</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Admin Actions */}
                    {bet.status === 'OPEN' && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-white/10">
                        {/* Settle */}
                        <div className="flex gap-2 flex-1">
                          <select
                            value={settleWinner[bet.id] || ''}
                            onChange={e => setSettleWinner(prev => ({ ...prev, [bet.id]: e.target.value }))}
                            className="flex-1 p-2 bg-white/10 border border-blue-600/50 rounded text-white text-xs"
                          >
                            <option value="">Pick winner...</option>
                            {bet.participants.map(p => (
                              <option key={p.userId} value={p.userId}>
                                {p.userName}{p.entryCount > 1 ? ` (${p.entryCount}×)` : ''}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSettle(bet.id)}
                            disabled={!settleWinner[bet.id] || isActioning}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-3 py-1.5 rounded text-xs font-medium"
                          >
                            {isActioning ? '...' : '✅ Settle'}
                          </button>
                        </div>
                        {/* Cancel */}
                        <button
                          onClick={() => handleCancel(bet.id)}
                          disabled={isActioning}
                          className="bg-red-600/20 hover:bg-red-600/30 text-red-300 px-3 py-1.5 rounded text-xs font-medium border border-red-500/30"
                        >
                          ✕ Cancel & Refund
                        </button>
                      </div>
                    )}

                    {/* Link to detail page */}
                    <div className="text-right">
                      <Link href={`/bets/${bet.id}`} className="text-blue-300 hover:text-blue-200 text-xs">
                        View full page →
                      </Link>
                    </div>
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
