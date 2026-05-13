'use client';

/**
 * RegistrantsPanel — admin/TD view of who has registered for an event and
 * whether they've paid (Lightning, in-person, or pay-on-arrival).
 *
 * Behavior:
 *  - Pulls the full registrant list from /api/events/:id/registrants (admin only).
 *  - For paid events, shows a payment-status badge per row and a "Mark Paid" button
 *    for unpaid rows. For free events, the payment column is hidden.
 *  - Counts at the top: total registered / paid / unpaid / waitlisted.
 */

import { useEffect, useState } from 'react';
import { eventsAPI } from '@/lib/api';

interface Registrant {
  id: string;
  userId: string;
  status: string;
  registeredAt: string;
  checkedInAt: string | null;
  paymentHash: string | null;
  paidAt: string | null;
  paidAmountSats: number | null;
  payOnArrival: boolean;
  paidInPerson: boolean;
  user: {
    id: string;
    name: string;
    email: string | null;
    isGuest?: boolean;
    avatar?: string | null;
    profile?: { profileImage?: string | null } | null;
  };
}

interface RegistrantsPanelProps {
  eventId: string;
  buyInSats: number; // 0 means free event
  onChange?: () => void; // called after mark-paid succeeds (so parent can refresh)
}

export default function RegistrantsPanel({ eventId, buyInSats, onChange }: RegistrantsPanelProps) {
  const [rows, setRows] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await eventsAPI.getRegistrants(eventId);
      setRows(data as Registrant[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load registrants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const isPaid = (r: Registrant) => !!r.paidAt;

  const markPaid = async (r: Registrant) => {
    if (!confirm(`Mark ${r.user.name} as paid in person?`)) return;
    try {
      setBusyId(r.id);
      await eventsAPI.markPaid(eventId, r.userId);
      await load();
      onChange?.();
    } catch (err: any) {
      alert(err.message || 'Failed to mark paid');
    } finally {
      setBusyId(null);
    }
  };

  const active = rows.filter((r) => r.status !== 'CANCELLED');
  const registered = active.filter((r) => r.status !== 'WAITLISTED');
  const waitlisted = active.filter((r) => r.status === 'WAITLISTED');
  const paid = registered.filter(isPaid).length;
  const unpaid = registered.length - paid;
  const isPaidEvent = buyInSats > 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-medium">
          👥 Registrants ({registered.length}
          {waitlisted.length > 0 && <> + {waitlisted.length} waitlisted</>})
        </h3>
        <button onClick={load} className="text-blue-300 hover:text-blue-200 text-sm">
          🔄 Refresh
        </button>
      </div>

      {isPaidEvent && (
        <div className="flex gap-2 mb-3 text-xs flex-wrap">
          <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded">
            ✅ Paid: {paid}
          </span>
          <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
            💵 Unpaid: {unpaid}
          </span>
          <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
            Buy-in: {buyInSats.toLocaleString()} sats
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-400 mx-auto"></div>
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : active.length === 0 ? (
        <p className="text-white/60 text-sm py-3">No registrants yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/60 border-b border-white/10">
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3">Registered</th>
                <th className="py-2 pr-3">Status</th>
                {isPaidEvent && <th className="py-2 pr-3">Payment</th>}
                {isPaidEvent && <th className="py-2 pr-3"></th>}
              </tr>
            </thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id} className="border-b border-white/5 align-top">
                  <td className="py-2 pr-3">
                    <span className="text-white font-medium">{r.user.name}</span>
                    {r.user.isGuest && (
                      <span className="ml-2 text-xs bg-gray-600/50 text-gray-300 px-1.5 py-0.5 rounded">
                        guest
                      </span>
                    )}
                    {r.user.email && (
                      <p className="text-white/40 text-xs">{r.user.email}</p>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-white/70 whitespace-nowrap">
                    {new Date(r.registeredAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        r.status === 'WAITLISTED'
                          ? 'bg-yellow-500/20 text-yellow-300'
                          : r.status === 'CHECKED_IN'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      {r.status.replace('_', ' ').toLowerCase()}
                    </span>
                  </td>
                  {isPaidEvent && (
                    <td className="py-2 pr-3">
                      {isPaid(r) ? (
                        <div>
                          <span className="text-green-400 text-xs font-semibold">
                            ✅ Paid
                            {r.paidAmountSats != null && (
                              <> ({r.paidAmountSats.toLocaleString()} sats)</>
                            )}
                          </span>
                          <p className="text-white/40 text-xs">
                            {r.paidInPerson ? 'in person' : '⚡ lightning'}
                            {r.paidAt && (
                              <>
                                {' '}
                                ·{' '}
                                {new Date(r.paidAt).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </>
                            )}
                          </p>
                        </div>
                      ) : r.payOnArrival ? (
                        <span className="text-blue-300 text-xs">💵 Pay on arrival</span>
                      ) : r.paymentHash ? (
                        <span className="text-yellow-300 text-xs">⏳ Invoice pending</span>
                      ) : (
                        <span className="text-white/40 text-xs">— no invoice</span>
                      )}
                    </td>
                  )}
                  {isPaidEvent && (
                    <td className="py-2 pr-3">
                      {!isPaid(r) && r.status !== 'WAITLISTED' && (
                        <button
                          onClick={() => markPaid(r)}
                          disabled={busyId === r.id}
                          className="bg-green-600 hover:bg-green-500 disabled:opacity-60 text-white text-xs px-2 py-1 rounded"
                        >
                          {busyId === r.id ? '…' : '✓ Mark Paid'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
