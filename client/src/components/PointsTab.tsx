'use client';

import { useState, useEffect } from 'react';
import { adminAPI, seasonsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface PointsUser {
  id: string;
  name: string;
  email: string | null;
  lastLoginAt: string | null;
  seasonPoints: number;
  rank: number | null;
}

interface Season {
  id: string;
  name: string;
  isActive: boolean;
}

interface PointsHistory {
  id: string;
  points: number;
  reason: string;
  createdAt: string;
  season: { name: string };
}

interface Props {
  setMessage: (msg: string) => void;
  setError: (msg: string) => void;
}

export default function PointsTab({ setMessage, setError }: Props) {
  const { user: adminUser } = useAuth();
  const [migrationStatus, setMigrationStatus] = useState<{ pointsHistoryEnabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningMigration, setRunningMigration] = useState(false);
  
  // Points management state
  const [users, setUsers] = useState<PointsUser[]>([]);
  const [activeSeason, setActiveSeason] = useState<Season | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // Default reason with admin name
  const defaultReason = `Manual by ${adminUser?.name || 'Admin'}`;
  
  // Award points form
  const [selectedUser, setSelectedUser] = useState<PointsUser | null>(null);
  const [pointsAmount, setPointsAmount] = useState<number>(0);
  const [pointsReason, setPointsReason] = useState(defaultReason);
  const [awarding, setAwarding] = useState(false);
  
  // User history modal
  const [viewingHistory, setViewingHistory] = useState<PointsUser | null>(null);
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Search/filter
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    checkMigrationStatus();
    fetchSeasons();
  }, []);

  const checkMigrationStatus = async () => {
    try {
      const status = await adminAPI.getMigrationStatus();
      setMigrationStatus(status);
      if (status.pointsHistoryEnabled) {
        fetchPointsUsers();
      }
    } catch (err: any) {
      console.error('Failed to check migration status:', err);
      // If endpoint doesn't exist, migration hasn't been run
      setMigrationStatus({ pointsHistoryEnabled: false });
    } finally {
      setLoading(false);
    }
  };

  const fetchSeasons = async () => {
    try {
      const data = await seasonsAPI.getAll();
      setSeasons(data);
    } catch (err) {
      console.error('Failed to fetch seasons:', err);
    }
  };

  const fetchPointsUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await adminAPI.getPointsUsers();
      setUsers(data.users || []);
      setActiveSeason(data.season);
    } catch (err: any) {
      console.error('Failed to fetch users:', err);
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleRunMigration = async () => {
    if (!confirm('This will add the Points History feature to your database. Continue?')) return;
    
    setRunningMigration(true);
    setError('');
    setMessage('');
    
    try {
      const result = await adminAPI.runMigration();
      setMessage(result.message);
      setMigrationStatus({ pointsHistoryEnabled: true });
      fetchPointsUsers();
    } catch (err: any) {
      setError(err.message || 'Migration failed');
    } finally {
      setRunningMigration(false);
    }
  };

  const handleAwardPoints = async () => {
    if (!selectedUser || !activeSeason || !pointsReason.trim()) {
      setError('Please select a user and provide a reason');
      return;
    }
    
    if (pointsAmount === 0) {
      setError('Points amount cannot be zero');
      return;
    }
    
    setAwarding(true);
    setError('');
    setMessage('');
    
    try {
      const result = await adminAPI.awardPoints({
        userId: selectedUser.id,
        seasonId: activeSeason.id,
        points: pointsAmount,
        reason: pointsReason.trim(),
      });
      
      setMessage(`${result.message} to ${selectedUser.name}`);
      setSelectedUser(null);
      setPointsAmount(0);
      setPointsReason(defaultReason);
      fetchPointsUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to award points');
    } finally {
      setAwarding(false);
    }
  };

  const handleViewHistory = async (user: PointsUser) => {
    setViewingHistory(user);
    setLoadingHistory(true);
    
    try {
      const data = await adminAPI.getPointsHistory(user.id);
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to fetch history:', err);
      setError(err.message || 'Failed to fetch history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
          <p className="text-gray-400 mt-2">Checking feature status...</p>
        </div>
      </div>
    );
  }

  // Show migration button if feature not enabled
  if (!migrationStatus?.pointsHistoryEnabled) {
    return (
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">🎯 Points Management</h2>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6 text-center">
          <h3 className="text-lg font-bold text-yellow-400 mb-2">⚠️ Feature Not Enabled</h3>
          <p className="text-gray-400 mb-4">
            The Points History feature requires a database update. Click the button below to enable it.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            This will add the ability to manually award/deduct points with full audit history.
          </p>
          
          <button
            onClick={handleRunMigration}
            disabled={runningMigration}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold"
          >
            {runningMigration ? (
              <>
                <span className="animate-spin inline-block mr-2">⏳</span>
                Running Migration...
              </>
            ) : (
              '🚀 Enable Points History Feature'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Award Points Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">🎯 Award Points</h2>
        
        {!activeSeason ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4 text-yellow-400">
            ⚠️ No active season. Please activate a season first.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
              <p className="text-purple-400 text-sm">
                <strong>Active Season:</strong> {activeSeason.name}
              </p>
            </div>
            
            {/* Search */}
            <div>
              <input
                type="text"
                placeholder="Search users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            
            {/* User Selection */}
            {selectedUser ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-green-400">{selectedUser.name}</p>
                    <p className="text-gray-400 text-sm">
                      Current Points: <span className="text-yellow-400 font-bold">{selectedUser.seasonPoints}</span>
                      {selectedUser.rank && <span className="ml-2">(Rank #{selectedUser.rank})</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕ Change
                  </button>
                </div>
                
                {/* Points Form */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">Points (+/-)</label>
                    <input
                      type="number"
                      value={pointsAmount}
                      onChange={(e) => setPointsAmount(parseInt(e.target.value) || 0)}
                      className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      placeholder="e.g., 50 or -10"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-gray-400 text-sm mb-1">Reason (required)</label>
                    <input
                      type="text"
                      value={pointsReason}
                      onChange={(e) => setPointsReason(e.target.value)}
                      className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                      placeholder="e.g., Manual adjustment by Jason, Bonus for helping setup"
                    />
                  </div>
                </div>
                
                <button
                  onClick={handleAwardPoints}
                  disabled={awarding || !pointsReason.trim() || pointsAmount === 0}
                  className={`mt-4 w-full py-3 rounded font-semibold ${
                    pointsAmount > 0 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : pointsAmount < 0 
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-gray-600'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed text-white`}
                >
                  {awarding ? '⏳ Processing...' : 
                   pointsAmount > 0 ? `➕ Award ${pointsAmount} Points` :
                   pointsAmount < 0 ? `➖ Deduct ${Math.abs(pointsAmount)} Points` :
                   'Enter points amount'}
                </button>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2">
                {loadingUsers ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-400 mx-auto"></div>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">
                    {searchTerm ? 'No users match your search' : 'No users found'}
                  </p>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex justify-between items-center bg-gray-700 p-3 rounded hover:bg-gray-600 cursor-pointer"
                      onClick={() => setSelectedUser(user)}
                    >
                      <div>
                        <span className="font-medium">{user.name}</span>
                        {user.email && (
                          <span className="text-gray-400 text-sm ml-2">{user.email}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-yellow-400 font-bold">{user.seasonPoints} pts</span>
                        {user.rank && (
                          <span className="text-gray-500 text-sm">#{user.rank}</span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewHistory(user);
                          }}
                          className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                          📜 History
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-bold mb-3">📊 Quick Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-700/50 rounded p-3">
            <p className="text-gray-400 text-xs">Total Players</p>
            <p className="text-xl font-bold text-green-400">{users.length}</p>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <p className="text-gray-400 text-xs">With Points</p>
            <p className="text-xl font-bold text-yellow-400">
              {users.filter(u => u.seasonPoints > 0).length}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <p className="text-gray-400 text-xs">Total Points</p>
            <p className="text-xl font-bold text-purple-400">
              {users.reduce((sum, u) => sum + u.seasonPoints, 0)}
            </p>
          </div>
          <div className="bg-gray-700/50 rounded p-3">
            <p className="text-gray-400 text-xs">Top Score</p>
            <p className="text-xl font-bold text-blue-400">
              {Math.max(...users.map(u => u.seasonPoints), 0)}
            </p>
          </div>
        </div>
      </div>

      {/* History Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">📜 Points History</h2>
                <p className="text-gray-400">{viewingHistory.name}</p>
              </div>
              <button
                onClick={() => setViewingHistory(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
              </div>
            ) : history.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No points history found</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="bg-gray-700 p-3 rounded">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-gray-300">{entry.reason}</p>
                        <p className="text-gray-500 text-xs mt-1">
                          {entry.season.name} • {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`font-bold ${entry.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {entry.points > 0 ? '+' : ''}{entry.points}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
