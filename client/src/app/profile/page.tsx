'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { eventsAPI, authAPI, standingsAPI, balanceAPI } from '@/lib/api';

interface UserEvent {
  id: string;
  name: string;
  dateTime: string;
  venue: { name: string };
  signups: { status: string }[];
  results: { position: number; pointsEarned: number }[];
}

interface SeasonStanding {
  season: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  standing: {
    totalPoints: number;
    eventsPlayed: number;
    wins: number;
    topThrees: number;
    knockouts: number;
    rank: number | null;
  } | null;
}

export default function ProfilePage() {
  const { user, isAuthenticated, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [myEvents, setMyEvents] = useState<UserEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [seasonStanding, setSeasonStanding] = useState<SeasonStanding | null>(null);
  const [loadingStanding, setLoadingStanding] = useState(true);
  const [stats, setStats] = useState({
    eventsPlayed: 0,
    totalPoints: 0,
    wins: 0,
    topThrees: 0,
  });
  
  // Lightning balance state
  const [lightningBalance, setLightningBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawalData, setWithdrawalData] = useState<{
    id: string;
    lnurl: string;
    qrData: string;
    lightningUri: string;
    amountSats: number;
  } | null>(null);
  const [withdrawalStatus, setWithdrawalStatus] = useState<'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED'>('PENDING');

  // Link Lightning wallet state
  const [linkingLightning, setLinkingLightning] = useState(false);
  const [linkLightningData, setLinkLightningData] = useState<{
    k1: string;
    qrCode: string;
  } | null>(null);
  const [linkLightningStatus, setLinkLightningStatus] = useState<'idle' | 'pending' | 'linked' | 'error'>('idle');
  const [showLightningBonus, setShowLightningBonus] = useState(false);

  // Add email/password state
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [addEmailData, setAddEmailData] = useState({ email: '', password: '', confirmPassword: '' });
  const [addingEmail, setAddingEmail] = useState(false);

  // Check if name has been set (locked)
  const nameIsLocked = user?.nameSetAt != null;
  // Check if user needs to set their real name (Lightning users with auto-generated names)
  const needsRealName = user?.authProvider === 'LIGHTNING' && !nameIsLocked && user?.name?.startsWith('Lightning_');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadMyEvents();
      loadSeasonStanding();
      loadBalance();
    }
  }, [isAuthenticated]);

  // Auto-open edit mode for users who need to set their name
  useEffect(() => {
    if (user && needsRealName && !isEditing) {
      setIsEditing(true);
      setEditName('');
      setEditEmail(user.email || '');
    }
  }, [user, needsRealName]);

  // Poll for withdrawal status when QR is shown
  useEffect(() => {
    if (!withdrawalData || withdrawalStatus !== 'PENDING') return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await balanceAPI.getWithdrawalStatus(withdrawalData.id);
        if (status.status === 'PAID') {
          setWithdrawalStatus('PAID');
          // Auto-close after showing success
          setTimeout(() => {
            setWithdrawalData(null);
            setWithdrawalStatus('PENDING');
            loadBalance();
          }, 3000);
        } else if (status.status === 'FAILED' || status.status === 'EXPIRED') {
          setWithdrawalStatus(status.status as 'FAILED' | 'EXPIRED');
        }
      } catch (err) {
        console.error('Failed to poll withdrawal status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [withdrawalData, withdrawalStatus]);

  // Poll for link lightning status when QR is shown
  useEffect(() => {
    if (!linkLightningData || linkLightningStatus !== 'pending') return;

    console.log('[LinkLightning] Starting polling for k1:', linkLightningData.k1);

    const pollInterval = setInterval(async () => {
      try {
        console.log('[LinkLightning] Polling status...');
        const status = await authAPI.linkLightningStatus(linkLightningData.k1);
        console.log('[LinkLightning] Status response:', status);
        
        if (status.status === 'linked') {
          console.log('[LinkLightning] Successfully linked!');
          setLinkLightningStatus('linked');
          if (status.token) {
            localStorage.setItem('token', status.token);
          }
          await refreshUser();
          // Show bonus notification if awarded
          if (status.lightningBonusAwarded) {
            setShowLightningBonus(true);
            setTimeout(() => setShowLightningBonus(false), 5000);
          }
          setSaveMessage({ type: 'success', text: 'Lightning wallet linked successfully!' });
          // Auto-close after showing success
          setTimeout(() => {
            setLinkLightningData(null);
            setLinkLightningStatus('idle');
          }, 2000);
        } else if (status.status === 'expired') {
          console.log('[LinkLightning] Challenge expired');
          setLinkLightningStatus('error');
          setSaveMessage({ type: 'error', text: 'Link request expired. Please try again.' });
          setLinkLightningData(null);
        } else {
          console.log('[LinkLightning] Still pending...');
        }
      } catch (err: any) {
        console.error('[LinkLightning] Poll error:', err);
        // Show ALL errors, not just "already linked"
        setLinkLightningStatus('error');
        setSaveMessage({ type: 'error', text: err.message || 'Failed to link Lightning wallet' });
        setLinkLightningData(null);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [linkLightningData, linkLightningStatus, refreshUser]);

  const loadBalance = async () => {
    setLoadingBalance(true);
    try {
      const data = await balanceAPI.get();
      setLightningBalance(data.balanceSats);
    } catch (err) {
      console.error('Failed to load balance:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleWithdraw = async () => {
    if (lightningBalance < 100) {
      setSaveMessage({ type: 'error', text: 'Minimum withdrawal is 100 sats' });
      return;
    }
    
    setWithdrawing(true);
    setSaveMessage(null);
    try {
      const result = await balanceAPI.withdraw();
      setWithdrawalData({
        id: result.withdrawal.id,
        lnurl: result.lnurl,
        qrData: result.qrData,
        lightningUri: result.lightningUri,
        amountSats: result.withdrawal.amountSats,
      });
      setWithdrawalStatus('PENDING');
      // Refresh balance after withdrawal initiated
      loadBalance();
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to initiate withdrawal' });
    } finally {
      setWithdrawing(false);
    }
  };

  const loadSeasonStanding = async () => {
    try {
      const data = await standingsAPI.getMy();
      setSeasonStanding(data);
    } catch (err) {
      console.error('Failed to load season standing:', err);
    } finally {
      setLoadingStanding(false);
    }
  };

  const loadMyEvents = async () => {
    setLoadingEvents(true);
    try {
      const events = await eventsAPI.getMy();
      setMyEvents(events);
      
      // Calculate stats from events
      let totalPoints = 0;
      let wins = 0;
      let topThrees = 0;
      
      events.forEach((event: UserEvent) => {
        if (event.results && event.results.length > 0) {
          const result = event.results[0];
          totalPoints += result.pointsEarned;
          if (result.position === 1) wins++;
          if (result.position <= 3) topThrees++;
        }
      });
      
      setStats({
        eventsPlayed: events.filter((e: UserEvent) => e.results && e.results.length > 0).length,
        totalPoints,
        wins,
        topThrees,
      });
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getAuthBadge = () => {
    if (!user) return '';
    switch (user.authProvider) {
      case 'GOOGLE':
        return '🔵 Google';
      case 'LIGHTNING':
        return '⚡ Lightning';
      default:
        return '✉️ Email';
    }
  };

  const startEditing = () => {
    setEditName(user?.name || '');
    setEditEmail(user?.email || '');
    setIsEditing(true);
    setSaveMessage(null);
  };

  const cancelEditing = () => {
    // Don't allow cancel if user needs to set their name
    if (needsRealName) {
      setSaveMessage({ type: 'error', text: 'Please set your real name before continuing' });
      return;
    }
    setIsEditing(false);
    setSaveMessage(null);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      setSaveMessage({ type: 'error', text: 'Name is required' });
      return;
    }

    if (editName.trim().length < 2) {
      setSaveMessage({ type: 'error', text: 'Name must be at least 2 characters' });
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const updateData: { name?: string; email?: string } = {};
      if (editName !== user?.name) updateData.name = editName.trim();
      if (editEmail !== user?.email) updateData.email = editEmail || undefined;

      if (Object.keys(updateData).length === 0) {
        setIsEditing(false);
        return;
      }

      const result = await authAPI.updateProfile(updateData);
      // Save new token
      if (result.token) {
        localStorage.setItem('token', result.token);
      }
      await refreshUser();
      setSaveMessage({ type: 'success', text: 'Profile updated successfully!' });
      setIsEditing(false);
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-black">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black">
      {/* Lightning Bonus Notification */}
      {showLightningBonus && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <div>
              <p className="font-bold">Thanks for linking Lightning!</p>
              <p className="text-sm">+1 Point awarded to your season standings!</p>
            </div>
            <button 
              onClick={() => setShowLightningBonus(false)}
              className="ml-2 text-black/60 hover:text-black"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-black/30 backdrop-blur-sm border-b border-green-700/50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-xl md:text-2xl font-bold text-white">
            🃏 RBBP
          </Link>
          <nav className="flex items-center gap-2 md:gap-4">
            <Link href="/events" className="text-white/80 hover:text-white text-sm md:text-base">Events</Link>
            <Link href="/leaderboard" className="text-white/80 hover:text-white text-sm md:text-base hidden sm:inline">Leaderboard</Link>
            <Link href="/dashboard" className="bg-green-600 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg hover:bg-green-700 text-sm md:text-base">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Back Link */}
        <Link href="/dashboard" className="text-green-400 hover:text-green-300 mb-4 md:mb-6 inline-block text-sm md:text-base">
          ← Back to Dashboard
        </Link>

        {/* Name Setup Banner for Lightning Users */}
        {needsRealName && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-6">
            <h3 className="text-yellow-400 font-bold text-lg mb-2">👋 Welcome! Please set your real name</h3>
            <p className="text-yellow-200/80 text-sm">
              Tournament directors need to identify players by name. Please enter your real name below - 
              <strong> this can only be set once</strong>, so make sure it's correct!
            </p>
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-4 md:p-6 mb-6">
          {!isEditing ? (
            <>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-green-600 rounded-full flex items-center justify-center text-white text-3xl md:text-4xl font-bold flex-shrink-0">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{user.name}</h1>
                  <p className="text-green-200">{user.email || 'No email set'}</p>
                  <p className="text-green-300/60 text-sm mt-1">
                    Logged in with {getAuthBadge()} • {user.role}
                  </p>
                  {nameIsLocked && (
                    <p className="text-green-400/60 text-xs mt-1">✓ Name verified</p>
                  )}
                </div>
                {!nameIsLocked && (
                  <button
                    onClick={startEditing}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition text-sm md:text-base w-full sm:w-auto"
                  >
                    ✏️ Edit Profile
                  </button>
                )}
              </div>

              {saveMessage && (
                <div className={`mt-4 p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {saveMessage.text}
                </div>
              )}

              {/* Admin badge if already admin */}
              {user.role === 'ADMIN' && (
                <div className="mt-6 pt-6 border-t border-green-600/30 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
                  <span className="inline-flex items-center gap-2 bg-purple-600/20 text-purple-300 px-4 py-2 rounded-lg text-sm">
                    👑 You are an Admin
                  </span>
                  <Link href="/admin" className="text-purple-400 hover:text-purple-300 underline text-sm">
                    Go to Admin Panel →
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div>
              <h2 className="text-xl font-bold text-white mb-4">
                {needsRealName ? '👤 Set Your Real Name' : '✏️ Edit Profile'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-green-200 text-sm mb-1">
                    {needsRealName ? 'Your Real Name *' : 'Display Name *'}
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-green-600/50 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-500"
                    placeholder={needsRealName ? "Enter your real name (e.g., John Smith)" : "Your display name"}
                    autoFocus={needsRealName}
                  />
                  {needsRealName && (
                    <p className="text-yellow-400/80 text-sm mt-1">
                      ⚠️ This can only be set once! Use your real name so tournament directors can identify you.
                    </p>
                  )}
                  {nameIsLocked && (
                    <p className="text-green-400/60 text-sm mt-1">
                      ✓ Your name has been set and cannot be changed.
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-green-200 text-sm mb-1">
                    Email {!user.email && <span className="text-yellow-400">(not set)</span>}
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-green-600/50 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-500"
                    placeholder="your@email.com"
                  />
                  {user.authProvider === 'LIGHTNING' && !user.email && (
                    <p className="text-yellow-400/80 text-sm mt-1">
                      💡 Adding an email lets you recover your account and receive notifications
                    </p>
                  )}
                </div>

                {saveMessage && (
                  <div className={`p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {saveMessage.text}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition w-full sm:w-auto"
                  >
                    {saving ? 'Saving...' : needsRealName ? 'Set My Name' : 'Save Changes'}
                  </button>
                  {!needsRealName && (
                    <button
                      onClick={cancelEditing}
                      disabled={saving}
                      className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-medium transition w-full sm:w-auto"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Linked Login Methods Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-4 md:p-6 mb-6">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">🔐 Login Methods</h2>
          
          <div className="space-y-3">
            {/* Email/Password Status */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✉️</span>
                <div>
                  <p className="text-white font-medium">Email & Password</p>
                  <p className="text-green-300/60 text-sm">
                    {user.email && user.authProvider !== 'LIGHTNING' ? user.email : 
                     user.email && user.authProvider === 'LIGHTNING' ? user.email : 'Not configured'}
                  </p>
                </div>
              </div>
              {user.email && user.authProvider !== 'LIGHTNING' ? (
                <span className="text-green-400 text-sm">✓ Linked</span>
              ) : user.authProvider === 'LIGHTNING' && !user.email ? (
                <button
                  onClick={() => setShowAddEmail(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
                >
                  + Add Email
                </button>
              ) : user.authProvider === 'LIGHTNING' && user.email ? (
                <span className="text-green-400 text-sm">✓ Linked</span>
              ) : null}
            </div>

            {/* Google Status */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔵</span>
                <div>
                  <p className="text-white font-medium">Google</p>
                  <p className="text-green-300/60 text-sm">
                    {user.googleId ? 'Connected' : 'Not connected'}
                  </p>
                </div>
              </div>
              {user.googleId ? (
                <span className="text-green-400 text-sm">✓ Linked</span>
              ) : (
                <span className="text-gray-500 text-sm">Coming soon</span>
              )}
            </div>

            {/* Lightning Status */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="text-white font-medium">Lightning Wallet</p>
                  <p className="text-green-300/60 text-sm">
                    {user.lightningPubkey ? `${user.lightningPubkey.slice(0, 8)}...${user.lightningPubkey.slice(-8)}` : 'Not connected'}
                  </p>
                </div>
              </div>
              {user.lightningPubkey ? (
                <span className="text-green-400 text-sm">✓ Linked</span>
              ) : (
                <button
                  onClick={async () => {
                    setLinkingLightning(true);
                    setLinkLightningStatus('pending');
                    try {
                      const challenge = await authAPI.linkLightningChallenge();
                      setLinkLightningData({ k1: challenge.k1, qrCode: challenge.qrCode });
                    } catch (err: any) {
                      setSaveMessage({ type: 'error', text: err.message || 'Failed to start linking' });
                      setLinkLightningStatus('error');
                    } finally {
                      setLinkingLightning(false);
                    }
                  }}
                  disabled={linkingLightning}
                  className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 text-black px-3 py-1.5 rounded-lg text-sm font-bold transition"
                >
                  {linkingLightning ? '...' : '⚡ Link Wallet'}
                </button>
              )}
            </div>
          </div>

          {/* Link Lightning QR Modal */}
          {linkLightningData && linkLightningStatus === 'pending' && (
            <div className="mt-4 p-4 bg-black/30 rounded-lg">
              <h3 className="text-white font-bold mb-2 text-center">⚡ Scan to Link Lightning Wallet</h3>
              <p className="text-yellow-400/80 text-xs text-center mb-4">
                Scan this QR code with your Lightning wallet to link it to your account.
              </p>
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-lg">
                  <img src={linkLightningData.qrCode} alt="Link Lightning QR" className="w-48 h-48" />
                </div>
                <button
                  onClick={() => {
                    setLinkLightningData(null);
                    setLinkLightningStatus('idle');
                  }}
                  className="text-gray-400 hover:text-white text-sm"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add Email Form Modal */}
          {showAddEmail && (
            <div className="mt-4 p-4 bg-black/30 rounded-lg">
              <h3 className="text-white font-bold mb-4">✉️ Add Email & Password</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-green-200 text-sm mb-1">Email</label>
                  <input
                    type="email"
                    value={addEmailData.email}
                    onChange={(e) => setAddEmailData({ ...addEmailData, email: e.target.value })}
                    className="w-full p-3 bg-white/10 border border-green-600/50 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-500"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-green-200 text-sm mb-1">Password</label>
                  <input
                    type="password"
                    value={addEmailData.password}
                    onChange={(e) => setAddEmailData({ ...addEmailData, password: e.target.value })}
                    className="w-full p-3 bg-white/10 border border-green-600/50 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-500"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-green-200 text-sm mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={addEmailData.confirmPassword}
                    onChange={(e) => setAddEmailData({ ...addEmailData, confirmPassword: e.target.value })}
                    className="w-full p-3 bg-white/10 border border-green-600/50 rounded-lg text-white placeholder-green-300/50 focus:outline-none focus:border-green-500"
                    placeholder="Confirm password"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={async () => {
                      if (addEmailData.password !== addEmailData.confirmPassword) {
                        setSaveMessage({ type: 'error', text: 'Passwords do not match' });
                        return;
                      }
                      if (addEmailData.password.length < 8) {
                        setSaveMessage({ type: 'error', text: 'Password must be at least 8 characters' });
                        return;
                      }
                      setAddingEmail(true);
                      try {
                        const result = await authAPI.addEmail({
                          email: addEmailData.email,
                          password: addEmailData.password,
                        });
                        if (result.token) {
                          localStorage.setItem('token', result.token);
                        }
                        await refreshUser();
                        setSaveMessage({ type: 'success', text: 'Email added successfully!' });
                        setShowAddEmail(false);
                        setAddEmailData({ email: '', password: '', confirmPassword: '' });
                      } catch (err: any) {
                        setSaveMessage({ type: 'error', text: err.message || 'Failed to add email' });
                      } finally {
                        setAddingEmail(false);
                      }
                    }}
                    disabled={addingEmail}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg font-medium transition"
                  >
                    {addingEmail ? 'Adding...' : 'Add Email'}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddEmail(false);
                      setAddEmailData({ email: '', password: '', confirmPassword: '' });
                    }}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Lightning Balance Card */}
        <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur rounded-xl border border-yellow-500/30 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              ⚡ Lightning Balance
            </h2>
            <button
              onClick={loadBalance}
              className="text-yellow-400 hover:text-yellow-300 text-sm"
            >
              🔄 Refresh
            </button>
          </div>
          
          {loadingBalance ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400"></div>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-3xl md:text-4xl font-bold text-yellow-400">
                  {lightningBalance.toLocaleString()} sats
                </p>
                <p className="text-yellow-200/60 text-sm">
                  ≈ ${((lightningBalance / 100000000) * 100000).toFixed(2)} USD
                </p>
              </div>
              
              {lightningBalance > 0 && !withdrawalData && (
                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing || lightningBalance < 100}
                  className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold px-6 py-3 rounded-lg transition w-full md:w-auto"
                >
                  {withdrawing ? '⏳ Processing...' : '⚡ Withdraw All'}
                </button>
              )}
              
              {lightningBalance === 0 && (
                <p className="text-yellow-200/60 text-sm">No balance to withdraw</p>
              )}
            </div>
          )}
          
          {/* Withdrawal QR Code Modal */}
          {withdrawalData && (
            <div className="mt-4 p-4 bg-black/30 rounded-lg">
              {withdrawalStatus === 'PAID' ? (
                // Success state
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-6xl">✅</div>
                  <h3 className="text-green-400 font-bold text-xl text-center">
                    Withdrawal Complete!
                  </h3>
                  <p className="text-green-200/80 text-center">
                    {withdrawalData.amountSats.toLocaleString()} sats sent to your wallet
                  </p>
                </div>
              ) : withdrawalStatus === 'FAILED' || withdrawalStatus === 'EXPIRED' ? (
                // Failed/Expired state
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-6xl">❌</div>
                  <h3 className="text-red-400 font-bold text-xl text-center">
                    Withdrawal {withdrawalStatus === 'EXPIRED' ? 'Expired' : 'Failed'}
                  </h3>
                  <p className="text-red-200/80 text-center">
                    Your balance has been refunded.
                  </p>
                  <button
                    onClick={() => {
                      setWithdrawalData(null);
                      setWithdrawalStatus('PENDING');
                      loadBalance();
                    }}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg transition"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                // Pending state - show QR
                <>
                  <h3 className="text-white font-bold mb-2 text-center">
                    ⚡ Scan to Withdraw {withdrawalData.amountSats.toLocaleString()} sats
                  </h3>
                  <p className="text-yellow-400/80 text-xs text-center mb-4">
                    Your balance has been reserved. Scan the QR code to complete the withdrawal.
                  </p>
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-lg">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(withdrawalData.qrData)}`}
                        alt="Withdrawal QR Code" 
                        className="w-48 h-48"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-yellow-200/80 text-sm mb-2">
                        Scan with your Lightning wallet or click below:
                      </p>
                      <a
                        href={withdrawalData.lightningUri}
                        className="inline-block bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-lg transition"
                      >
                        📱 Open in Wallet
                      </a>
                    </div>
                    <div className="text-center text-xs text-gray-400 mt-2">
                      <p>If you don't complete the withdrawal, your balance will be refunded when it expires (24 hours).</p>
                    </div>
                    <button
                      onClick={() => {
                        setWithdrawalData(null);
                        setWithdrawalStatus('PENDING');
                        loadBalance();
                      }}
                      className="text-gray-400 hover:text-white text-sm mt-2"
                    >
                      ✕ Close
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          
          <p className="text-yellow-200/50 text-xs mt-4 text-center">
            💡 Winnings are credited to your balance. Withdraw anytime to your Lightning wallet!
          </p>
        </div>

        {/* Season Points Card */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur rounded-xl border border-yellow-500/30 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                🏆 Season Points
              </h2>
              {seasonStanding?.season && (
                <p className="text-yellow-200/70 text-sm">{seasonStanding.season.name}</p>
              )}
            </div>
            <Link href="/leaderboard" className="text-yellow-400 hover:text-yellow-300 text-sm">
              View Leaderboard →
            </Link>
          </div>
          
          {loadingStanding ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400"></div>
            </div>
          ) : !seasonStanding?.season ? (
            <p className="text-yellow-200/60 text-center py-4">No active season</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-yellow-400">
                  {seasonStanding.standing?.totalPoints || 0}
                </p>
                <p className="text-yellow-200/70 text-xs">Points</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-white">
                  {seasonStanding.standing?.rank ? `#${seasonStanding.standing.rank}` : '-'}
                </p>
                <p className="text-yellow-200/70 text-xs">Rank</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-white">
                  {seasonStanding.standing?.eventsPlayed || 0}
                </p>
                <p className="text-yellow-200/70 text-xs">Events</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-green-400">
                  {seasonStanding.standing?.wins || 0}
                </p>
                <p className="text-yellow-200/70 text-xs">Wins</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-orange-400">
                  {seasonStanding.standing?.knockouts || 0}
                </p>
                <p className="text-yellow-200/70 text-xs">KOs</p>
              </div>
            </div>
          )}
        </div>

        {/* All-Time Stats */}
        <h3 className="text-white font-semibold mb-3 text-sm">All-Time Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-green-400">{stats.totalPoints}</p>
            <p className="text-green-200 text-xs md:text-sm">Total Points</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-white">{stats.eventsPlayed}</p>
            <p className="text-green-200 text-xs md:text-sm">Events Played</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-yellow-400">{stats.wins}</p>
            <p className="text-green-200 text-xs md:text-sm">Wins</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-orange-400">{stats.topThrees}</p>
            <p className="text-green-200 text-xs md:text-sm">Top 3 Finishes</p>
          </div>
        </div>

        {/* Event History */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">📅 Event History</h2>
          
          {loadingEvents ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
            </div>
          ) : myEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-green-300/60">No events yet</p>
              <Link href="/events" className="text-green-400 hover:underline mt-2 inline-block">
                Browse upcoming events →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block p-3 md:p-4 bg-white/5 rounded-lg hover:bg-white/10 transition"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-white font-medium text-sm md:text-base truncate">{event.name}</h3>
                      <p className="text-green-300/60 text-xs md:text-sm truncate">
                        {event.venue.name} • {formatDate(event.dateTime)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {event.results && event.results.length > 0 ? (
                        <>
                          <p className="text-white font-bold text-sm md:text-base">
                            {event.results[0].position === 1 ? '🥇' : 
                             event.results[0].position === 2 ? '🥈' : 
                             event.results[0].position === 3 ? '🥉' : 
                             `#${event.results[0].position}`}
                          </p>
                          <p className="text-green-400 text-xs md:text-sm">{event.results[0].pointsEarned} pts</p>
                        </>
                      ) : event.signups && event.signups.length > 0 ? (
                        <span className="text-blue-400 text-xs md:text-sm">Registered</span>
                      ) : (
                        <span className="text-gray-400 text-xs md:text-sm">-</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
