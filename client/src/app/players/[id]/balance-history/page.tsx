'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { balanceAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface BalanceTransaction {
  id: string;
  type: string;
  amountSats: number;
  note: string | null;
  balanceAfter: number;
  createdAt: string;
}

interface BalanceHistoryData {
  user: { id: string; name: string; lightningBalanceSats: number };
  transactions: BalanceTransaction[];
}

const CREDIT_TYPES = new Set(['CREDIT', 'DEPOSIT', 'REFUND']);
const DEBIT_TYPES = new Set(['DEBIT', 'WITHDRAWAL', 'STORE_PURCHASE', 'STORE_PURCHASE_LIGHTNING', 'SIDE_BET_ENTRY']);

function formatType(type: string) {
  return type
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getTransactionSign(tx: BalanceTransaction) {
  if (CREDIT_TYPES.has(tx.type)) return '+';
  if (DEBIT_TYPES.has(tx.type)) return '-';
  return '';
}

function getTransactionColor(tx: BalanceTransaction) {
  if (CREDIT_TYPES.has(tx.type)) return 'text-green-300';
  if (DEBIT_TYPES.has(tx.type)) return 'text-red-300';
  return 'text-blue-200';
}

export default function BalanceHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [data, setData] = useState<BalanceHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canView = useMemo(() => {
    if (!user) return false;
    return user.id === playerId || user.role === 'ADMIN';
  }, [user, playerId]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!canView) {
      setError('You can only view your own balance history.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    balanceAPI.getPlayerHistory(playerId, 150)
      .then(result => {
        if (!cancelled) setData(result);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Failed to load balance history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, canView, playerId, router]);

  return (
    <div className="min-h-screen page-gradient-profile">
      <MobileNav />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link href={`/players/${playerId}`} className="text-blue-300 hover:text-blue-200 text-sm mb-6 inline-block">
          ← Back to Player Profile
        </Link>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-white">⚡ Balance History</h1>
              <p className="text-blue-100 mt-1">
                {data?.user.name || 'Player'} Lightning balance activity
              </p>
            </div>
            {data && (
              <div className="bg-black/20 rounded-xl px-4 py-3 border border-white/10 sm:text-right">
                <p className="text-blue-200 text-xs uppercase tracking-wide">Current Balance</p>
                <p className="text-2xl font-bold text-yellow-300">{data.user.lightningBalanceSats.toLocaleString()} sats</p>
              </div>
            )}
          </div>
        </div>

        {loading || authLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-blue-100 mt-4">Loading balance history...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/20 border border-red-400 text-red-100 rounded-xl p-6 text-center">
            {error}
          </div>
        ) : !data || data.transactions.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-8 text-center">
            <p className="text-white/70">No balance transactions yet.</p>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 overflow-hidden">
            <div className="hidden md:grid grid-cols-[170px_1fr_150px_150px] gap-4 px-5 py-3 border-b border-blue-600/30 text-blue-200 text-xs uppercase tracking-wide">
              <div>Date</div>
              <div>Description</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Balance After</div>
            </div>

            <div className="divide-y divide-blue-600/20">
              {data.transactions.map(tx => {
                const sign = getTransactionSign(tx);
                const color = getTransactionColor(tx);
                return (
                  <div key={tx.id} className="grid md:grid-cols-[170px_1fr_150px_150px] gap-2 md:gap-4 px-5 py-4 hover:bg-white/5 transition">
                    <div className="text-blue-200/70 text-sm">
                      {new Date(tx.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                    <div>
                      <p className="text-white font-medium">{tx.note || formatType(tx.type)}</p>
                      <p className="text-blue-200/60 text-xs mt-0.5">{formatType(tx.type)}</p>
                    </div>
                    <div className={`md:text-right font-bold ${color}`}>
                      {sign}{tx.amountSats.toLocaleString()} sats
                    </div>
                    <div className="md:text-right text-yellow-200 text-sm">
                      <span className="md:hidden text-blue-200/60">Balance after: </span>
                      {tx.balanceAfter.toLocaleString()} sats
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
