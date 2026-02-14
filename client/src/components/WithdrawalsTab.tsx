'use client';

import { useState, useEffect } from 'react';
import { withdrawalsAPI } from '@/lib/api';

interface User {
  id: string;
  email: string | null;
  name: string;
}

interface Withdrawal {
  id: string;
  k1: string;
  userId: string;
  amountSats: number;
  description: string | null;
  status: 'PENDING' | 'CLAIMED' | 'PAID' | 'EXPIRED' | 'FAILED';
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
  lnurl?: string;
  qrData?: string;
  lightningUri?: string;
}

interface NodeStatus {
  configured: boolean;
  connected: boolean;
  nodeAlias?: string;
  balanceSats?: number;
  pendingSats?: number;
  error?: string;
}

interface WithdrawalStats {
  pending: number;
  paid: number;
  failed: number;
  totalPaidSats: number;
}

interface Props {
  users: User[];
  fetchUsers: () => void;
  setMessage: (msg: string) => void;
  setError: (err: string) => void;
}

export default function WithdrawalsTab({ users, fetchUsers, setMessage, setError }: Props) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);
  
  // Create form
  const [createForm, setCreateForm] = useState({
    userId: '',
    amountSats: 1000,
    description: '',
  });
  const [creating, setCreating] = useState(false);
  const [newWithdrawal, setNewWithdrawal] = useState<{
    withdrawal: any;
    lnurl: string;
    qrData: string;
    lightningUri: string;
  } | null>(null);

  useEffect(() => {
    fetchData();
    if (users.length === 0) {
      fetchUsers();
    }
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [withdrawalsData, nodeData, statsData] = await Promise.all([
        withdrawalsAPI.getAll(),
        withdrawalsAPI.getNodeStatus(),
        withdrawalsAPI.getStats(),
      ]);
      setWithdrawals(withdrawalsData);
      setNodeStatus(nodeData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch withdrawal data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.userId || createForm.amountSats < 1) {
      setError('Please select a user and enter a valid amount');
      return;
    }

    setCreating(true);
    try {
      const result = await withdrawalsAPI.create({
        userId: createForm.userId,
        amountSats: createForm.amountSats,
        description: createForm.description || undefined,
      });
      setNewWithdrawal(result);
      setMessage(`Withdrawal created for ${createForm.amountSats} sats!`);
      setCreateForm({ userId: '', amountSats: 1000, description: '' });
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to create withdrawal');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this withdrawal?')) return;
    try {
      await withdrawalsAPI.cancel(id);
      setMessage('Withdrawal cancelled');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel withdrawal');
    }
  };

  const viewWithdrawal = async (id: string) => {
    try {
      const data = await withdrawalsAPI.getById(id);
      setSelectedWithdrawal(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load withdrawal');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-600/30 text-yellow-400';
      case 'CLAIMED':
        return 'bg-blue-600/30 text-blue-400';
      case 'PAID':
        return 'bg-blue-600/30 text-blue-300';
      case 'EXPIRED':
        return 'bg-gray-600/30 text-gray-400';
      case 'FAILED':
        return 'bg-red-600/30 text-red-400';
      default:
        return 'bg-gray-600/30 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
        <p className="text-gray-400 mt-2">Loading withdrawals...</p>
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
              <p className="text-gray-400 text-xs">Available Balance</p>
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
            <p className="text-sm mt-1">{nodeStatus?.error || 'Configure VOLTAGE_REST_HOST and VOLTAGE_MACAROON in environment variables'}</p>
          </div>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Pending</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.pending}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Paid</p>
            <p className="text-2xl font-bold text-blue-300">{stats.paid}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Failed</p>
            <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-gray-400 text-xs">Total Paid</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.totalPaidSats.toLocaleString()} sats</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Withdrawal Form */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">⚡ Create Withdrawal</h2>
          
          {!nodeStatus?.connected ? (
            <div className="text-yellow-400 bg-yellow-400/10 p-4 rounded">
              ⚠️ Lightning node not connected. Configure Voltage credentials to enable withdrawals.
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1">User *</label>
                <select
                  value={createForm.userId}
                  onChange={(e) => setCreateForm({ ...createForm, userId: e.target.value })}
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
                  value={createForm.amountSats}
                  onChange={(e) => setCreateForm({ ...createForm, amountSats: parseInt(e.target.value) || 0 })}
                  required
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="e.g., 10000"
                />
                <p className="text-gray-500 text-xs mt-1">
                  ≈ ${((createForm.amountSats / 100000000) * 100000).toFixed(2)} USD (at $100k/BTC)
                </p>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Description</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                  placeholder="e.g., 1st Place - Tuesday Poker"
                />
              </div>
              <button
                type="submit"
                disabled={creating || !createForm.userId || createForm.amountSats < 1}
                className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white py-3 rounded font-semibold"
              >
                {creating ? 'Creating...' : '⚡ Create Withdrawal'}
              </button>
            </form>
          )}
        </div>

        {/* Recent Withdrawals */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Recent Withdrawals</h2>
            <button onClick={fetchData} className="text-blue-300 hover:text-blue-200 text-sm">
              🔄 Refresh
            </button>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {withdrawals.length === 0 ? (
              <p className="text-gray-400 text-center py-4">No withdrawals yet</p>
            ) : (
              withdrawals.map((w) => (
                <div key={w.id} className="bg-gray-700 p-3 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{w.user.name}</p>
                      <p className="text-yellow-400 font-bold">{w.amountSats.toLocaleString()} sats</p>
                      {w.description && (
                        <p className="text-gray-400 text-xs">{w.description}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-1">
                        {new Date(w.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <span className={`text-xs px-2 py-1 rounded ${getStatusBadge(w.status)}`}>
                        {w.status}
                      </span>
                      {w.status === 'PENDING' && (
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => viewWithdrawal(w.id)}
                            className="text-blue-400 hover:text-blue-300 text-xs"
                          >
                            📱 QR
                          </button>
                          <button
                            onClick={() => handleCancel(w.id)}
                            className="text-red-400 hover:text-red-300 text-xs"
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Withdrawal QR Modal */}
      {newWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md text-center">
            <h2 className="text-xl font-bold mb-2">⚡ Withdrawal Created!</h2>
            <p className="text-gray-400 mb-4">
              {newWithdrawal.withdrawal.amountSats.toLocaleString()} sats
            </p>
            
            {/* QR Code */}
            <div className="bg-white p-4 rounded-lg inline-block mb-4">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(newWithdrawal.qrData)}`}
                alt="Withdrawal QR Code"
                className="w-48 h-48"
              />
            </div>
            
            <p className="text-gray-400 text-sm mb-4">
              Scan with any Lightning wallet to receive sats
            </p>
            
            {/* Mobile Link */}
            <a
              href={newWithdrawal.lightningUri}
              className="block w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded font-semibold mb-3"
            >
              📱 Open in Wallet
            </a>
            
            <button
              onClick={() => setNewWithdrawal(null)}
              className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* View Withdrawal QR Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md text-center">
            <h2 className="text-xl font-bold mb-2">⚡ Withdrawal for {selectedWithdrawal.user.name}</h2>
            <p className="text-yellow-400 font-bold text-2xl mb-2">
              {selectedWithdrawal.amountSats.toLocaleString()} sats
            </p>
            {selectedWithdrawal.description && (
              <p className="text-gray-400 mb-4">{selectedWithdrawal.description}</p>
            )}
            
            {selectedWithdrawal.status === 'PENDING' && selectedWithdrawal.qrData ? (
              <>
                {/* QR Code */}
                <div className="bg-white p-4 rounded-lg inline-block mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(selectedWithdrawal.qrData)}`}
                    alt="Withdrawal QR Code"
                    className="w-48 h-48"
                  />
                </div>
                
                <p className="text-gray-400 text-sm mb-4">
                  Scan with any Lightning wallet to receive sats
                </p>
                
                {/* Mobile Link */}
                {selectedWithdrawal.lightningUri && (
                  <a
                    href={selectedWithdrawal.lightningUri}
                    className="block w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded font-semibold mb-3"
                  >
                    📱 Open in Wallet
                  </a>
                )}
              </>
            ) : (
              <div className={`p-4 rounded mb-4 ${getStatusBadge(selectedWithdrawal.status)}`}>
                Status: {selectedWithdrawal.status}
                {selectedWithdrawal.paidAt && (
                  <p className="text-sm mt-1">
                    Paid: {new Date(selectedWithdrawal.paidAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
            
            <button
              onClick={() => setSelectedWithdrawal(null)}
              className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
