'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { sideBetsAPI } from '@/lib/api';

interface SideBetDetail {
  id: string;
  label: string;
  creator: { id: string; name: string };
  event: { id: string; name: string } | null;
  entrySats: number;
  feePct: number;
  status: 'OPEN' | 'SETTLED' | 'CANCELLED';
  winner: { id: string; name: string } | null;
  settledAt: string | null;
  createdAt: string;
  entryCount: number;
  totalPot: number;
  feeAmount: number;
  prizeAmount: number;
  entries: { id: string; userId: string; userName: string; paidAt: string | null }[];
}

export default function SideBetDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [bet, setBet] = useState<SideBetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Payment state
  const [invoice, setInvoice] = useState<{ paymentRequest: string; paymentHash: string; amountSats: number } | null>(null);
  const [paying, setPaying] = useState(false);
  const [paymentPaid, setPaymentPaid] = useState(false);

  // Settle state
  const [settling, setSettling] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState('');
  const [settleMessage, setSettleMessage] = useState('');

  // Cancel state
  const [cancelling, setCancelling] = useState(false);

  const loadBet = useCallback(async () => {
    try {
      const data = await sideBetsAPI.getById(id as string);
      setBet(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load side bet');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBet();
  }, [loadBet]);

  // Poll for payment when invoice is shown
  useEffect(() => {
    if (!invoice || paymentPaid) return;
    const interval = setInterval(async () => {
      try {
        const result = await sideBetsAPI.checkPayment(id as string);
        if (result.paid) {
          setPaymentPaid(true);
          setInvoice(null);
          loadBet();
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [invoice, paymentPaid, id, loadBet]);

  const isCreator = user?.id === bet?.creator?.id;
  const hasEntered = bet?.entries.some(e => e.userId === user?.id);

  const handleEnter = async () => {
    setPaying(true);
    setError('');
    try {
      let result;
      if (isCreator && !hasEntered) {
        // Creator re-entering (shouldn't happen normally, but handle edge case)
        result = await sideBetsAPI.enter(id as string);
      } else {
        result = await sideBetsAPI.enter(id as string);
      }
      setInvoice(result.invoice);
      setPaymentPaid(false);
    } catch (err: any) {
      setError(err.message || 'Failed to generate invoice');
    } finally {
      setPaying(false);
    }
  };

  const handleSettle = async () => {
    if (!selectedWinner) return;
    setSettling(true);
    setError('');
    try {
      const result = await sideBetsAPI.settle(id as string, selectedWinner);
      setSettleMessage(result.message);
      loadBet();
    } catch (err: any) {
      setError(err.message || 'Failed to settle bet');
    } finally {
      setSettling(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this bet? All entries will be refunded.')) return;
    setCancelling(true);
    setError('');
    try {
      await sideBetsAPI.cancel(id as string);
      loadBet();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel bet');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  if (loading) {
    return (
      <div className="min-h-screen">
        <MobileNav currentPage="home" />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
        </div>
      </div>
    );
  }

  if (!bet) {
    return (
      <div className="min-h-screen">
        <MobileNav currentPage="home" />
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-red-400 text-lg">{error || 'Side bet not found'}</p>
          <Link href="/" className="text-blue-300 hover:text-blue-200 mt-4 inline-block">← Back Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <MobileNav currentPage="home" />
      <main className="max-w-2xl mx-auto px-4 py-6 md:py-8">
        <Link href="/" className="text-blue-300 hover:text-blue-200 mb-4 inline-block text-sm">← Back</Link>

        {/* Header */}
        <div className="bg-white/10 backdrop-blur rounded-xl border border-blue-600/30 p-5 mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">{bet.label}</h1>
              <p className="text-blue-300 text-sm mt-1">
                Created by <Link href={`/players/${bet.creator.id}`} className="text-blue-200 hover:underline">{bet.creator.name}</Link>
              </p>
              {bet.event && (
                <p className="text-blue-300 text-xs mt-1">
                  🎰 <Link href={`/events/${bet.event.id}`} className="hover:underline">{bet.event.name}</Link>
                </p>
              )}
              <p className="text-blue-300/60 text-xs mt-1">{formatDate(bet.createdAt)}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              bet.status === 'OPEN' ? 'bg-green-500/20 text-green-300 border border-green-500/30' :
              bet.status === 'SETTLED' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
              'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}>
              {bet.status}
            </span>
          </div>
        </div>

        {/* Pot Info */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white/10 rounded-xl p-4 text-center border border-white/10">
            <p className="text-2xl font-bold text-yellow-400">⚡ {bet.entrySats.toLocaleString()}</p>
            <p className="text-blue-200 text-xs">Entry (sats)</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center border border-white/10">
            <p className="text-2xl font-bold text-white">{bet.entryCount}</p>
            <p className="text-blue-200 text-xs">Entries</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl p-4 text-center border border-yellow-500/30">
            <p className="text-2xl font-bold text-yellow-300">⚡ {bet.totalPot.toLocaleString()}</p>
            <p className="text-yellow-200 text-xs">Total Pot</p>
          </div>
        </div>

        {/* Winner Display */}
        {bet.status === 'SETTLED' && bet.winner && (
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl border border-yellow-500/30 p-5 mb-4 text-center">
            <p className="text-yellow-300 text-sm font-medium mb-1">🏆 Winner</p>
            <p className="text-2xl font-bold text-white">{bet.winner.name}</p>
            <p className="text-yellow-300 text-sm mt-1">Won {bet.prizeAmount.toLocaleString()} sats</p>
            {bet.feeAmount > 0 && (
              <p className="text-yellow-200/60 text-xs mt-1">({bet.feePct}% fee: {bet.feeAmount.toLocaleString()} sats)</p>
            )}
          </div>
        )}

        {bet.status === 'CANCELLED' && (
          <div className="bg-red-500/10 rounded-xl border border-red-500/30 p-4 mb-4 text-center">
            <p className="text-red-300 font-medium">This bet was cancelled. All entries were refunded.</p>
          </div>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 mb-4 text-red-300 text-sm">{error}</div>
        )}
        {settleMessage && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-4 text-green-300 text-sm">{settleMessage}</div>
        )}
        {paymentPaid && (
          <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3 mb-4 text-green-300 text-sm">
            ✅ Payment confirmed! You're in the bet.
          </div>
        )}

        {/* Actions */}
        {bet.status === 'OPEN' && isAuthenticated && (
          <div className="bg-white/10 rounded-xl border border-blue-600/30 p-5 mb-4">
            {/* Enter Button */}
            {!hasEntered && !invoice && (
              <button
                onClick={handleEnter}
                disabled={paying}
                className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition"
              >
                {paying ? '⏳ Generating Invoice...' : `⚡ Enter for ${bet.entrySats.toLocaleString()} sats`}
              </button>
            )}

            {hasEntered && !isCreator && (
              <p className="text-green-300 text-center font-medium">✅ You're in this bet!</p>
            )}

            {/* Lightning Invoice QR */}
            {invoice && !paymentPaid && (
              <div className="text-center">
                <h3 className="text-white font-bold mb-3">⚡ Pay {invoice.amountSats.toLocaleString()} sats to enter</h3>
                <div className="bg-white p-4 rounded-lg inline-block mb-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoice.paymentRequest)}`}
                    alt="Lightning Invoice QR"
                    className="w-48 h-48"
                  />
                </div>
                <div>
                  <button
                    onClick={() => navigator.clipboard.writeText(invoice.paymentRequest)}
                    className="text-blue-300 hover:text-blue-200 text-xs"
                  >
                    📋 Copy Invoice
                  </button>
                </div>
                <button
                  onClick={() => setInvoice(null)}
                  className="text-gray-400 hover:text-white text-sm mt-3"
                >
                  ✕ Cancel
                </button>
              </div>
            )}

            {/* Creator: Settle / Cancel */}
            {isCreator && bet.entryCount >= 2 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <h3 className="text-white font-bold text-sm mb-2">👑 Pick Winner</h3>
                <div className="flex gap-2">
                  <select
                    value={selectedWinner}
                    onChange={(e) => setSelectedWinner(e.target.value)}
                    className="flex-1 p-2 bg-white/10 border border-blue-600/50 rounded-lg text-white text-sm"
                  >
                    <option value="">Select winner...</option>
                    {bet.entries.map(e => (
                      <option key={e.userId} value={e.userId}>{e.userName}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleSettle}
                    disabled={!selectedWinner || settling}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    {settling ? '...' : '✅ Settle'}
                  </button>
                </div>
              </div>
            )}

            {isCreator && (
              <div className="mt-3 text-center">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  {cancelling ? 'Cancelling...' : '✕ Cancel & Refund All'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Not logged in */}
        {bet.status === 'OPEN' && !isAuthenticated && (
          <div className="bg-white/10 rounded-xl border border-blue-600/30 p-5 mb-4 text-center">
            <p className="text-blue-300 mb-3">Log in to enter this side bet</p>
            <Link href="/login" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition inline-block">
              Sign In
            </Link>
          </div>
        )}

        {/* Entries List */}
        <div className="bg-white/10 rounded-xl border border-blue-600/30 p-5">
          <h2 className="text-white font-bold mb-3">Participants ({bet.entryCount})</h2>
          {bet.entries.length === 0 ? (
            <p className="text-blue-300 text-sm text-center py-4">No entries yet</p>
          ) : (
            <div className="space-y-2">
              {bet.entries.map((entry, i) => (
                <div key={entry.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs w-5">{i + 1}.</span>
                    <Link href={`/players/${entry.userId}`} className="text-white hover:text-blue-200 text-sm">
                      {entry.userName}
                    </Link>
                    {entry.userId === bet.creator.id && (
                      <span className="text-yellow-400 text-xs">👑</span>
                    )}
                    {bet.winner?.id === entry.userId && (
                      <span className="text-yellow-400 text-xs font-bold">🏆</span>
                    )}
                  </div>
                  <span className="text-blue-300/60 text-xs">{bet.entrySats.toLocaleString()} sats</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
