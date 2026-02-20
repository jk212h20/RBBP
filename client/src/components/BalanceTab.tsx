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

  useEffect(() => {
    fetchData();
    if (users.length === 0) {
      fetchUsers();
    }
  }, []);

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
      setMessage(`Credited ${creditForm.amountSats} sats! New balance: ${result.newBalance} sats`);
      setCreditForm({ userId: '', amountSats: 1000, reason: '' });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to credit balance');
    } finally {
      setCrediting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
        <p className="text-gray-400 mt-2">Loading balances...</p>
      </div>
    );
  }

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
              <label className="block text-gray-400 mb-1">Reason (optional)</label>
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded font-semibold"
            >
              {crediting ? 'Crediting...' : '💰 Credit Balance'}
            </button>
          </form>
          
          <p className="text-gray-500 text-sm mt-4">
            💡 Credits are added to the user's balance. They can withdraw anytime from their profile.
          </p>
        </div>

        {/* Users with Balances */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">👥 User Balances</h2>
            <button onClick={fetchData} className="text-blue-300 hover:text-blue-200 text-sm">
              🔄 Refresh
            </button>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {usersWithBalances.filter(u => u.lightningBalanceSats > 0).length === 0 ? (
              <p className="text-gray-400 text-center py-4">No users with balance</p>
            ) : (
              usersWithBalances
                .filter(u => u.lightningBalanceSats > 0)
                .map((u) => (
                  <div key={u.id} className="bg-gray-700 p-3 rounded flex justify-between items-center">
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-gray-400 text-xs">{u.email || 'No email'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 font-bold">{u.lightningBalanceSats.toLocaleString()} sats</p>
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
      </div>
    </div>
  );
}
