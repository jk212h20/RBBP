'use client';

import { useEffect, useState } from 'react';
import { venueFinanceAPI, venuesAPI } from '@/lib/api';

type VenueInvoice = {
  id: string;
  venueId: string;
  amountSats: number;
  memo: string;
  internalNote?: string | null;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'WAIVED' | 'FAILED';
  paymentRequest?: string | null;
  expiresAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  venue?: { id: string; name: string; address?: string; managerId?: string | null };
  manager?: { id: string; name: string; email?: string | null } | null;
  createdBy?: { id: string; name: string; email?: string | null };
};

type Props = {
  mode: 'admin' | 'manager';
};

const statusStyles: Record<VenueInvoice['status'], string> = {
  PENDING: 'bg-yellow-900/50 text-yellow-200 border-yellow-600/50',
  PAID: 'bg-green-900/50 text-green-200 border-green-600/50',
  EXPIRED: 'bg-orange-900/50 text-orange-200 border-orange-600/50',
  CANCELLED: 'bg-gray-800 text-gray-300 border-gray-600',
  WAIVED: 'bg-blue-900/50 text-blue-200 border-blue-600/50',
  FAILED: 'bg-red-900/50 text-red-200 border-red-600/50',
};

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent || '');
}

export default function VenueInvoicesPanel({ mode }: Props) {
  const isAdmin = mode === 'admin';
  const [invoices, setInvoices] = useState<VenueInvoice[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({ venueId: '', amountSats: '', memo: '', internalNote: '', dueAt: '' });

  useEffect(() => {
    loadData();
  }, [mode]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [invoiceData, venueData] = await Promise.all([
        isAdmin ? venueFinanceAPI.getAdminInvoices() : venueFinanceAPI.getMyInvoices(),
        isAdmin ? venuesAPI.getAll(true) : Promise.resolve([]),
      ]);
      setInvoices(invoiceData.invoices);
      setVenues(venueData);
      if (isAdmin && !form.venueId && venueData[0]) setForm(prev => ({ ...prev, venueId: venueData[0].id }));
    } catch (err: any) {
      setError(err.message || 'Failed to load venue bills');
    } finally {
      setLoading(false);
    }
  };

  const withAction = async (action: () => Promise<void>, success: string) => {
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await action();
      setMessage(success);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const createInvoice = () => withAction(async () => {
    await venueFinanceAPI.createInvoice({
      venueId: form.venueId,
      amountSats: parseInt(form.amountSats, 10),
      memo: form.memo,
      internalNote: form.internalNote || undefined,
      dueAt: form.dueAt || undefined,
    });
    setForm(prev => ({ ...prev, amountSats: '', memo: '', internalNote: '', dueAt: '' }));
  }, 'Venue bill created');

  const checkInvoice = (invoice: VenueInvoice) => withAction(async () => {
    if (isAdmin) await venueFinanceAPI.adminCheckInvoice(invoice.id);
    else await venueFinanceAPI.checkMyInvoice(invoice.id);
  }, 'Invoice status checked');

  const copyInvoice = async (invoice: VenueInvoice) => {
    if (!invoice.paymentRequest) return;
    await navigator.clipboard.writeText(invoice.paymentRequest);
    setCopiedId(invoice.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (loading) return <div className="text-gray-400 py-8">Loading venue bills...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">🏢 Venue Bills / Invoices</h2>
        <p className="text-gray-400">
          {isAdmin
            ? 'Create and administer Lightning invoices for venues.'
            : 'View and pay bills for venues assigned to your account.'}
        </p>
      </div>

      {message && <div className="bg-green-900/50 border border-green-600 text-green-200 p-3 rounded-lg">{message}</div>}
      {error && <div className="bg-red-900/50 border border-red-600 text-red-200 p-3 rounded-lg">{error}</div>}

      {isAdmin && (
        <div className="bg-gray-800 border border-blue-700/50 rounded-lg p-6 space-y-4">
          <h3 className="text-xl font-bold text-blue-300">Create Venue Bill</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Venue</label>
              <select value={form.venueId} onChange={(e) => setForm(prev => ({ ...prev, venueId: e.target.value }))} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white">
                {venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Amount sats</label>
              <input type="number" min="1" value={form.amountSats} onChange={(e) => setForm(prev => ({ ...prev, amountSats: e.target.value }))} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" placeholder="50000" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Memo / reason</label>
              <input value={form.memo} onChange={(e) => setForm(prev => ({ ...prev, memo: e.target.value }))} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" placeholder="July hosting fee" />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Due date optional</label>
              <input type="date" value={form.dueAt} onChange={(e) => setForm(prev => ({ ...prev, dueAt: e.target.value }))} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Internal note optional</label>
            <textarea value={form.internalNote} onChange={(e) => setForm(prev => ({ ...prev, internalNote: e.target.value }))} className="w-full bg-gray-900 border border-gray-600 rounded p-3 text-white" rows={2} />
          </div>
          <button onClick={createInvoice} disabled={saving || !form.venueId || !form.amountSats || !form.memo} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-3 rounded-lg font-semibold">
            Create Lightning Bill
          </button>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-bold">{isAdmin ? 'All Venue Bills' : 'My Venue Bills'}</h3>
          <button onClick={loadData} className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1 rounded">Refresh</button>
        </div>

        {invoices.length === 0 ? (
          <div className="p-6 text-gray-400">No venue bills yet.</div>
        ) : (
          <div className="divide-y divide-gray-700">
            {invoices.map(invoice => {
              const expanded = expandedId === invoice.id;
              const lightningHref = isMobileDevice() && invoice.paymentRequest ? `phoenix:lightning:${invoice.paymentRequest}` : `lightning:${invoice.paymentRequest}`;
              return (
                <div key={invoice.id} className="p-4">
                  <button onClick={() => setExpandedId(expanded ? null : invoice.id)} className="w-full text-left flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{invoice.venue?.name || 'Venue'}</span>
                        <span className={`text-xs border px-2 py-1 rounded-full ${statusStyles[invoice.status]}`}>{invoice.status}</span>
                      </div>
                      <div className="text-gray-300 text-sm mt-1">{invoice.memo}</div>
                      <div className="text-gray-500 text-xs mt-1">Created {new Date(invoice.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="md:text-right">
                      <div className="text-yellow-300 text-xl font-bold">{invoice.amountSats.toLocaleString()} sats</div>
                      <div className="text-gray-400 text-sm">{expanded ? '▲ Hide' : '▼ Details'}</div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="mt-4 bg-gray-900/70 rounded-lg p-4 grid lg:grid-cols-[1fr_280px] gap-5">
                      <div className="space-y-3 text-sm">
                        <div><span className="text-gray-400">Venue:</span> {invoice.venue?.name}</div>
                        {invoice.manager && <div><span className="text-gray-400">Manager:</span> {invoice.manager.name}</div>}
                        {invoice.dueAt && <div><span className="text-gray-400">Due:</span> {new Date(invoice.dueAt).toLocaleDateString()}</div>}
                        {invoice.expiresAt && invoice.status === 'PENDING' && <div><span className="text-gray-400">Lightning invoice expires:</span> {new Date(invoice.expiresAt).toLocaleString()}</div>}
                        {invoice.paidAt && <div><span className="text-gray-400">Paid:</span> {new Date(invoice.paidAt).toLocaleString()}</div>}
                        {invoice.internalNote && isAdmin && <div><span className="text-gray-400">Internal note:</span> {invoice.internalNote}</div>}

                        <div className="flex flex-wrap gap-2 pt-2">
                          {invoice.status === 'PENDING' && invoice.paymentRequest && (
                            <>
                              <a href={lightningHref} className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg">
                                Open Phoenix and Pay
                              </a>
                              <button onClick={() => copyInvoice(invoice)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg">
                                {copiedId === invoice.id ? 'Copied!' : 'Copy Invoice'}
                              </button>
                            </>
                          )}
                          {invoice.status === 'PENDING' && <button onClick={() => checkInvoice(invoice)} disabled={saving} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg">Check Payment</button>}
                          {isAdmin && invoice.status === 'PENDING' && <button onClick={() => withAction(() => venueFinanceAPI.cancelInvoice(invoice.id), 'Invoice cancelled')} disabled={saving} className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg">Cancel</button>}
                          {isAdmin && invoice.status === 'PENDING' && <button onClick={() => withAction(() => venueFinanceAPI.waiveInvoice(invoice.id), 'Invoice waived')} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg">Waive</button>}
                          {isAdmin && ['PENDING', 'EXPIRED', 'FAILED'].includes(invoice.status) && <button onClick={() => withAction(() => venueFinanceAPI.regenerateInvoice(invoice.id), 'Invoice regenerated')} disabled={saving} className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg">Regenerate</button>}
                        </div>

                        {invoice.paymentRequest && (
                          <textarea readOnly value={invoice.paymentRequest} className="w-full h-24 bg-black/40 border border-gray-700 rounded p-2 text-xs text-gray-300 font-mono" />
                        )}
                      </div>

                      {invoice.status === 'PENDING' && invoice.paymentRequest && (
                        <div className="flex flex-col items-center justify-center bg-white rounded-lg p-4">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(invoice.paymentRequest)}`}
                            alt="Venue invoice QR"
                            className="w-56 h-56"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
