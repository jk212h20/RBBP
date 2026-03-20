'use client';

import { useState, useEffect } from 'react';
import { balanceAPI, withdrawalsAPI } from '@/lib/api';

interface User {
  id: string;
  email: string | null;
  name: string;
  lightningBalanceSats: number;
  role: string;
}

interface BalanceStats {
  totalOutstanding: number;
  usersWithBalance: number;
  averageBalance: number;
  maxBalance: number;
}

interface NodeStatus {
  configured: boolean;
  connected: boolean;
  nodeAlias?: string;
  balanceSats?: number;
  pendingSats?: number;
  error?: string;
}

interface Transaction {
  id: string;
  userId: string;
  type: string;
  amountSats: number;
  note: string | null;
  adminId: string | null;
  balanceAfter: number;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
}

interface Props {
  users: { id: string; email: string | null; name: string }[];
  fetchUsers: () => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
}

export default function BalanceTab({ users, fetchUsers, setMessage, setError }: Props) {
  const [usersWithBalances, setUsersWithBalances] = useState<User[]>([]);
  const [stats, setStats] = useState<BalanceStats | null>(null);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Credit form
  const [creditForm, setCreditForm] = useState({
    userId: '',
    amountSats: 1000,
    reason: '',
  });
  const [crediting, setCrediting] = useState(false);

  // Debit form
  const [debitForm, setDebitForm] = useState({
    userId: '',
    amountSats: 0,
    reason: '',
  });
  const [debiting, setDebiting] = useState(false);

  // Transaction history
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [txLoading, setTxLoading] = useState(false);
  const [txFilter, setTxFilter] = useState<string>('');
  const [txPage, setTxPage] = useState(0);
  const TX_PAGE_SIZE = 20;

  // User transaction drill-down
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [userTxLoading, setUserTxLoading] = useState(false);

  useEffect(() => {
    fetchData();
    fetchTransactions();
    if (users.length === 0) {
      fetchUsers();
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [txFilter, txPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersData, statsData, nodeData] = await Promise.all([
        balanceAPI.getAllUsers(),
        balanceAPI.getStats(),
        withdrawalsAPI.getNodeStatus(),
      ]);
      setUsersWithBalances(usersData);
      setStats(statsData);
      setNodeStatus(nodeData);
    } catch (err) {
      console.error('Failed to fetch balance data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setTxLoading(true);
    try {
      const result = await balanceAPI.getTransactions(
        TX_PAGE_SIZE,
        txPage * TX_PAGE_SIZE,
        txFilter || undefined
      );
      setTransactions(result.transactions);
      setTransactionsTotal(result.total);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setTxLoading(false);
    }
  };

  const fetchUserTransactions = async (userId: string) => {
    setSelectedUserId(userId);
    setUserTxLoading(true);
    try {
      const txs = await balanceAPI.getUserTransactions(userId, 30);
      setUserTransactions(txs);
    } catch (err) {
      console.error('Failed to fetch user transactions:', err);
    } finally {
      setUserTxLoading(false);
    }
  };

  const handleCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditForm.userId || creditForm.amountSats < 1) {
      setError('Please select a user and enter a valid amount');
      return;
    }

    setCrediting(true);
    try {
      const result = await balanceAPI.credit({
        userId: creditForm.userId,
        amountSats: creditForm.amountSats,
        reason: creditForm.reason || undefined,
      });
      setMessage(`Credited ${creditForm.amountSats.toLocaleString()} sats! New balance: ${result.newBalance.toLocaleString()} sats`);
      setCreditForm({ userId: '', amountSats: 1000, reason: '' });
      fetchData();
      fetchTransactions();
    } catch (err: any) {
      setError(err.message || 'Failed to credit balance');
    } finally {
      setCrediting(false);
    }
  };

  const handleDebit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debitForm.userId || debitForm.amountSats < 1) {
      setError('Please select a user and enter a valid amount');
      return;
    }
    if (!debitForm.reason.trim()) {
      setError('A reason/note is required for debits');
      return;
    }

    setDebiting(true);
    try {
      const result = await balanceAPI.debit({
        userId: debitForm.userId,
        amountSats: debitForm.amountSats,
        reason: debitForm.reason,
      });
      setMessage(`Debited ${debitForm.amountSats.toLocaleString()} sats. New balance: ${result.newBalance.toLocaleString()} sats`);
      setDebitForm({ userId: '', amountSats: 0, reason: '' });
      fetchData();
      fetchTransactions();
    } catch (err: any) {
      setError(err.message || 'Failed to debit balance');
    } finally {
      setDebiting(false);
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case 'CREDIT': return 'text-green-400';
      case 'DEBIT': return 'text-red-400';
      case 'WITHDRAWAL': return 'text-orange-400';
      case 'REFUND': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'CREDIT': return '➕';
      case 'DEBIT': return '➖';
      case 'WITHDRAWAL': return '⚡';
      case 'REFUND': return '🔄';
      default: return '•';
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
        <p className="text-gray-400 mt-2">Loading balances...</p>
      </div>
    );
  }

  const selectedUserName = selectedUserId 
    ? usersWithBalances.find(u => u.id === selectedUserId)?.name || 'Unknown'
    : '';

  return (
    <div className="space-y-6">
      {/* Node Status Card */}
      <div className={`rounded-lg p-6 border ${
        nodeStatus?.connected 
          ? 'bg-gradient-to-r from-yellow-900/30 to-orange-800/20 border-yellow-500/30' 
          : 'bg-red-900/20 border-red-500/30'
      }`}>
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          ⚡ Lightning Node Status
        </h3>
        {nodeStatus?.connected ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-xs">Status</p>
              <p className="text-blue-300 font-bold">✅ Connected</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Node Alias</p>
              <p className="text-yellow-400 font-bold">{nodeStatus.nodeAlias || 'Unknown'}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Node Balance</p>
              <p className="text-yellow-400 font-bold">{(nodeStatus.balanceSats || 0).toLocaleString()} sats</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Pending</p>
              <p className="text-gray-400">{(nodeStatus.pendingSats || 0).toLocaleString()} sats</p>
            </div>
          </div>
        ) : (
          <div className="text-red-400">
            <p className="font-bold">❌ Not Connected</p>
            <p className="text-sm mt-1">{nodeStatus?.error || 'Configure VOLTAGE_REST_HOST and VOLTAGE_MACAROON'}</p>
          </div>
        )}
      </div>

      {/* Balance Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Outstanding</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.totalOutstanding.toLocaleString()} sats</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Users with Balance</p>
            <p className="text-2xl font-bold text-blue-300">{stats.usersWithBalance}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Average Balance</p>
            <p className="text-2xl font-bold text-white">{stats.averageBalance.toLocaleString()} sats</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Max Balance</p>
            <p className="text-2xl font-bold text-orange-400">{stats.maxBalance.toLocaleString()} sats</p>
          </div>
        </div>
      )}

      {/* Credit & Debit Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Credit Balance Form */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">💰 Credit User Balance</h2>
          
          <form onSubmit={handleCredit} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-1">User *</label>
              <select
                value={creditForm.userId}
                onChange={(e) => setCreditForm({ ...creditForm, userId: e.target.value })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
              >
                <option value="">Select a user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.email ? `(${u.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Amount (sats) *</label>
              <input
                type="number"
                min="1"
                value={creditForm.amountSats}
                onChange={(e) => setCreditForm({ ...creditForm, amountSats: parseInt(e.target.value) || 0 })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="e.g., 10000"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Note (optional)</label>
              <input
                type="text"
                value={creditForm.reason}
                onChange={(e) => setCreditForm({ ...creditForm, reason: e.target.value })}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="e.g., 1st Place - Tuesday Poker"
              />
            </div>
            <button
              type="submit"
              disabled={crediting || !creditForm.userId || creditForm.amountSats < 1}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 rounded font-semibold"
            >
              {crediting ? 'Crediting...' : '➕ Credit Balance'}
            </button>
          </form>
        </div>

        {/* Debit Balance Form */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🔻 Debit User Balance</h2>
          
          <form onSubmit={handleDebit} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-1">User *</label>
              <select
                value={debitForm.userId}
                onChange={(e) => setDebitForm({ ...debitForm, userId: e.target.value })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
              >
                <option value="">Select a user</option>
                {usersWithBalances
                  .filter(u => u.lightningBalanceSats > 0)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.lightningBalanceSats.toLocaleString()} sats
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Amount (sats) *</label>
              <input
                type="number"
                min="1"
                value={debitForm.amountSats || ''}
                onChange={(e) => setDebitForm({ ...debitForm, amountSats: parseInt(e.target.value) || 0 })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="e.g., 5000"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Reason / Note *</label>
              <input
                type="text"
                value={debitForm.reason}
                onChange={(e) => setDebitForm({ ...debitForm, reason: e.target.value })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="e.g., Correction - duplicate credit"
              />
              <p className="text-gray-500 text-xs mt-1">Required — explains why sats are being removed</p>
            </div>
            <button
              type="submit"
              disabled={debiting || !debitForm.userId || debitForm.amountSats < 1 || !debitForm.reason.trim()}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-3 rounded font-semibold"
            >
              {debiting ? 'Debiting...' : '➖ Debit Balance'}
            </button>
          </form>
        </div>
      </div>

      {/* User Balances */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">👥 User Balances</h2>
          <button onClick={fetchData} className="text-blue-300 hover:text-blue-200 text-sm">
            🔄 Refresh
          </button>
        </div>
        
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {usersWithBalances.filter(u => u.lightningBalanceSats > 0).length === 0 ? (
            <p className="text-gray-400 text-center py-4">No users with balance</p>
          ) : (
            usersWithBalances
              .filter(u => u.lightningBalanceSats > 0)
              .map((u) => (
                <div 
                  key={u.id} 
                  className={`bg-gray-700 p-3 rounded flex justify-between items-center cursor-pointer hover:bg-gray-600 transition ${
                    selectedUserId === u.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => fetchUserTransactions(u.id)}
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-gray-400 text-xs">{u.email || 'No email'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">{u.lightningBalanceSats.toLocaleString()} sats</p>
                    <p className="text-gray-500 text-xs">Click for history</p>
                  </div>
                </div>
              ))
          )}
        </div>
        
        {/* All users list (collapsed) */}
        <details className="mt-4">
          <summary className="text-gray-400 cursor-pointer hover:text-gray-300 text-sm">
            Show all users ({usersWithBalances.length})
          </summary>
          <div className="space-y-2 mt-2 max-h-48 overflow-y-auto">
            {usersWithBalances.map((u) => (
              <div key={u.id} className="bg-gray-700/50 p-2 rounded flex justify-between items-center text-sm">
                <span>{u.name}</span>
                <span className={u.lightningBalanceSats > 0 ? 'text-yellow-400' : 'text-gray-500'}>
                  {u.lightningBalanceSats.toLocaleString()} sats
                </span>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* User Transaction Drill-Down */}
      {selectedUserId && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">
              📋 History — {selectedUserName}
            </h2>
            <button 
              onClick={() => { setSelectedUserId(null); setUserTransactions([]); }}
              className="text-gray-400 hover:text-white text-sm"
            >
              ✕ Close
            </button>
          </div>
          
          {userTxLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto"></div>
            </div>
          ) : userTransactions.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No transactions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-left py-2 pr-4">Type</th>
                    <th className="text-right py-2 pr-4">Amount</th>
                    <th className="text-right py-2 pr-4">Balance After</th>
                    <th className="text-left py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {userTransactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-700/50">
                      <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                      <td className={`py-2 pr-4 font-medium ${typeColor(tx.type)}`}>
                        {typeIcon(tx.type)} {tx.type}
                      </td>
                      <td className={`py-2 pr-4 text-right font-mono ${
                        tx.type === 'CREDIT' || tx.type === 'REFUND' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.type === 'CREDIT' || tx.type === 'REFUND' ? '+' : '-'}{tx.amountSats.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300 font-mono">{tx.balanceAfter.toLocaleString()}</td>
                      <td className="py-2 text-gray-400 max-w-[200px] truncate">{tx.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Global Transaction History */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <h2 className="text-xl font-bold">📜 Transaction History</h2>
          <div className="flex items-center gap-2">
            <select
              value={txFilter}
              onChange={(e) => { setTxFilter(e.target.value); setTxPage(0); }}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="">All Types</option>
              <option value="CREDIT">Credits</option>
              <option value="DEBIT">Debits</option>
              <option value="WITHDRAWAL">Withdrawals</option>
              <option value="REFUND">Refunds</option>
            </select>
            <button onClick={fetchTransactions} className="text-blue-300 hover:text-blue-200 text-sm">
              🔄
            </button>
          </div>
        </div>

        {txLoading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400 mx-auto"></div>
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            No transactions yet. Credits and debits will appear here.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-2 pr-4">Date</th>
                    <th className="text-left py-2 pr-4">User</th>
                    <th className="text-left py-2 pr-4">Type</th>
                    <th className="text-right py-2 pr-4">Amount</th>
                    <th className="text-right py-2 pr-4">Balance</th>
                    <th className="text-left py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{formatDate(tx.createdAt)}</td>
                      <td className="py-2 pr-4 text-white">{tx.user.name}</td>
                      <td className={`py-2 pr-4 font-medium ${typeColor(tx.type)}`}>
                        {typeIcon(tx.type)} {tx.type}
                      </td>
                      <td className={`py-2 pr-4 text-right font-mono ${
                        tx.type === 'CREDIT' || tx.type === 'REFUND' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {tx.type === 'CREDIT' || tx.type === 'REFUND' ? '+' : '-'}{tx.amountSats.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300 font-mono">{tx.balanceAfter.toLocaleString()}</td>
                      <td className="py-2 text-gray-400 max-w-[250px] truncate">{tx.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {transactionsTotal > TX_PAGE_SIZE && (
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
                <p className="text-gray-400 text-sm">
                  Showing {txPage * TX_PAGE_SIZE + 1}–{Math.min((txPage + 1) * TX_PAGE_SIZE, transactionsTotal)} of {transactionsTotal}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTxPage(p => p - 1)}
                    disabled={txPage === 0}
                    className="px-3 py-1 bg-gray-700 rounded text-sm disabled:opacity-50 hover:bg-gray-600"
                  >
                    ← Prev
                  </button>
                  <button
                    onClick={() => setTxPage(p => p + 1)}
                    disabled={(txPage + 1) * TX_PAGE_SIZE >= transactionsTotal}
                    className="px-3 py-1 bg-gray-700 rounded text-sm disabled:opacity-50 hover:bg-gray-600"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
