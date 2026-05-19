'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { useAuth } from '@/context/AuthContext';
import { sideBetsAPI, eventsAPI } from '@/lib/api';

export default function CreateSideBetPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [entrySats, setEntrySats] = useState('500');
  const [eventId, setEventId] = useState('');
  const [events, setEvents] = useState<{ id: string; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Invoice state for creator's entry payment
  const [invoice, setInvoice] = useState<{ paymentRequest: string; amountSats: number } | null>(null);
  const [betId, setBetId] = useState('');
  const [paymentPaid, setPaymentPaid] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/login');
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    eventsAPI.getUpcoming(20).then(setEvents).catch(() => {});
  }, []);

  // Poll for creator payment
  useEffect(() => {
    if (!invoice || !betId || paymentPaid) return;
    const interval = setInterval(async () => {
      try {
        const result = await sideBetsAPI.checkPayment(betId);
        if (result.paid) {
          setPaymentPaid(true);
          setInvoice(null);
          setTimeout(() => router.push(`/bets/${betId}`), 1500);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [invoice, betId, paymentPaid, router]);

  const handleCreate = async () => {
    if (!label.trim()) { setError('Give your bet a label'); return; }
    const sats = parseInt(entrySats);
    if (!sats || sats < 100) { setError('Entry must be at least 100 sats'); return; }
    if (sats > 1000000) { setError('Entry cannot exceed 1,000,000 sats'); return; }

    setCreating(true);
    setError('');
    try {
      const result = await sideBetsAPI.create({
        label: label.trim(),
        description: description.trim() || undefined,
        entrySats: sats,
        eventId: eventId || undefined,
      });
      setBetId(result.sideBet.id);
      setInvoice({ paymentRequest: result.invoice.paymentRequest, amountSats: result.invoice.amountSats });
    } catch (err: any) {
      setError(err.message || 'Failed to create side bet');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen page-gradient-bets">
      <MobileNav currentPage="home" />
      <main className="max-w-lg mx-auto px-4 py-6 md:py-8">
        <Link href="/" className="text-blue-300 hover:text-blue-200 mb-4 inline-block text-sm">← Back</Link>
        <h1 className="text-2xl font-bold text-white mb-6">🎲 Create a Side Bet</h1>

        {!invoice ? (
          <div className="bg-white/10 backdrop-blur rounded-xl border border-blue-600/30 p-5 space-y-4">
            <div>
              <label className="block text-blue-100 text-sm mb-1">What's the bet?</label>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                maxLength={100}
                className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                placeholder='e.g. "First to bust pays the table"'
              />
            </div>

            <div>
              <label className="block text-blue-100 text-sm mb-1">Details <span className="text-blue-300/60">(optional)</span></label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500 text-sm resize-none"
                placeholder="Rules, context, or anything else players should know..."
              />
            </div>

            <div>
              <label className="block text-blue-100 text-sm mb-1">Entry amount (sats)</label>
              <input
                type="number"
                value={entrySats}
                onChange={e => setEntrySats(e.target.value)}
                min={100}
                max={1000000}
                className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
              />
              <p className="text-blue-300/60 text-xs mt-1">Everyone pays this to enter. You (the creator) decide the winner.</p>
            </div>

            <div>
              <label className="block text-blue-100 text-sm mb-1">Link to an event? <span className="text-blue-300/60">(optional)</span></label>
              <select
                value={eventId}
                onChange={e => setEventId(e.target.value)}
                className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white text-sm"
              >
                <option value="">No event</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">{error}</div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black font-bold py-3 rounded-lg transition"
            >
              {creating ? '⏳ Creating...' : '⚡ Create & Pay Entry'}
            </button>

            <p className="text-blue-300/50 text-xs text-center">
              You'll pay the entry amount via Lightning to activate the bet. You're automatically entered.
            </p>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur rounded-xl border border-blue-600/30 p-5 text-center">
            {paymentPaid ? (
              <div className="py-8">
                <p className="text-4xl mb-3">✅</p>
                <p className="text-green-300 font-bold text-lg">Bet created!</p>
                <p className="text-blue-300 text-sm mt-2">Redirecting...</p>
              </div>
            ) : (
              <>
                <h2 className="text-white font-bold mb-2">⚡ Pay {invoice.amountSats.toLocaleString()} sats to activate</h2>
                <p className="text-blue-300 text-xs mb-4">This is your entry into the bet</p>
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
                  onClick={() => { setInvoice(null); setBetId(''); }}
                  className="text-gray-400 hover:text-white text-sm mt-4"
                >
                  ✕ Cancel
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
