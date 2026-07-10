'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import MobileNav from '@/components/MobileNav';
import { eventsAPI, authAPI, standingsAPI, balanceAPI, withdrawalsAPI, playersAPI, sideBetsAPI } from '@/lib/api';
import ReferralTab from '@/components/ReferralTab';
import InvoiceActions from '@/components/InvoiceActions';

interface UserEvent {
  id: string;
  slug?: string;
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

function SideBetsSection() {
  const [myBets, setMyBets] = useState<{ created: any[]; entered: any[] } | null>(null);
  const [loadingBets, setLoadingBets] = useState(true);

  useEffect(() => {
    sideBetsAPI.getMy().then(setMyBets).catch(() => {}).finally(() => setLoadingBets(false));
  }, []);

  const allBets = myBets ? [...myBets.created, ...myBets.entered.filter(e => !myBets.created.some((c: any) => c.id === e.id))] : [];
  const activeBets = allBets.filter((b: any) => b.status === 'OPEN');
  const completedBets = allBets.filter((b: any) => b.status !== 'OPEN');

  if (loadingBets) return null;
  if (allBets.length === 0 && activeBets.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white">🎲 Side Bets</h2>
        </div>
        <div className="text-center py-4">
          <p className="text-blue-300 text-sm mb-3">No side bets yet</p>
          <Link href="/bets/create" className="text-blue-300 hover:text-blue-200 text-sm font-medium transition">
            + Create a Side Bet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg md:text-xl font-bold text-white">🎲 Side Bets</h2>
        <Link href="/bets/create" className="text-blue-300 hover:text-blue-200 text-sm">+ New Bet</Link>
      </div>
      {activeBets.length > 0 && (
        <div className="mb-3">
          <h3 className="text-blue-200 text-xs font-medium uppercase mb-2">Active</h3>
          <div className="space-y-2">
            {activeBets.map((bet: any) => (
              <Link key={bet.id} href={`/bets/${bet.id}`} className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                <div className="flex justify-between items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium text-sm truncate">{bet.label}</p>
                    <p className="text-blue-300 text-xs">{bet.entryCount || bet._count?.entries || 0} entries · ⚡ {bet.entrySats} sats each</p>
                  </div>
                  <span className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full font-medium ml-2">OPEN</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {completedBets.length > 0 && (
        <div>
          <h3 className="text-blue-200 text-xs font-medium uppercase mb-2">Completed</h3>
          <div className="space-y-2">
            {completedBets.slice(0, 5).map((bet: any) => (
              <Link key={bet.id} href={`/bets/${bet.id}`} className="block p-3 bg-white/5 rounded-lg hover:bg-white/10 transition">
                <div className="flex justify-between items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-white/70 font-medium text-sm truncate">{bet.label}</p>
                    <p className="text-blue-300/60 text-xs">
                      {bet.winner ? `🏆 ${bet.winner.name}` : bet.status === 'CANCELLED' ? 'Cancelled' : ''}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 ${
                    bet.status === 'SETTLED' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-300'
                  }`}>{bet.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
  const [withdrawalStatus, setWithdrawalStatus] = useState<'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED'>('PENDING');
  const [cancellingWithdrawal, setCancellingWithdrawal] = useState(false);

  // Lightning deposit state
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmountInput, setDepositAmountInput] = useState('10000');
  const [depositing, setDepositing] = useState(false);
  const [depositData, setDepositData] = useState<{
    id: string;
    paymentRequest: string;
    qrData: string;
    lightningUri: string;
    amountSats: number;
    expiresAt: string;
  } | null>(null);
  const [depositStatus, setDepositStatus] = useState<'amount' | 'pending' | 'settled' | 'expired' | 'failed' | 'error'>('amount');
  const [depositError, setDepositError] = useState('');
  const [depositCountdown, setDepositCountdown] = useState('');
  const [depositLimits, setDepositLimits] = useState({
    minDepositSats: 100,
    maxDepositSats: 250000,
    invoiceExpirySeconds: 600,
  });

  // Link Phoenix / Lightning login state
  const [linkingLightning, setLinkingLightning] = useState(false);
  const [linkLightningData, setLinkLightningData] = useState<{
    k1: string;
    lnurl: string;
    qrCode: string;
  } | null>(null);
  const [linkLightningStatus, setLinkLightningStatus] = useState<'idle' | 'pending' | 'linked' | 'error'>('idle');
  const [copiedLinkLnurl, setCopiedLinkLnurl] = useState(false);
  const [showLightningBonus, setShowLightningBonus] = useState(false);

  // Withdrawal history state
  const [myWithdrawals, setMyWithdrawals] = useState<any[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true);

  // Add email/password state
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [addEmailData, setAddEmailData] = useState({ email: '', password: '', confirmPassword: '' });
  const [addingEmail, setAddingEmail] = useState(false);

  // Profile details state (bio + profile image + telegram)
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [telegramVerified, setTelegramVerified] = useState(false);
  const [telegramVisibility, setTelegramVisibility] = useState<'PUBLIC' | 'ADMIN_ONLY'>('ADMIN_ONLY');
  const [nostrPubkey, setNostrPubkey] = useState('');
  const [nostrVisibility, setNostrVisibility] = useState<'PUBLIC' | 'ADMIN_ONLY'>('ADMIN_ONLY');
  const [verifyingTelegram, setVerifyingTelegram] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editProfileImage, setEditProfileImage] = useState<string | null>(null);
  const [editTelegramUsername, setEditTelegramUsername] = useState('');
  const [editTelegramVisibility, setEditTelegramVisibility] = useState<'PUBLIC' | 'ADMIN_ONLY'>('ADMIN_ONLY');
  const [editNostrPubkey, setEditNostrPubkey] = useState('');
  const [editNostrVisibility, setEditNostrVisibility] = useState<'PUBLIC' | 'ADMIN_ONLY'>('ADMIN_ONLY');
  const [savingDetails, setSavingDetails] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);

  // Social links state
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});
  const [socialLinksVisibility, setSocialLinksVisibility] = useState<'PUBLIC' | 'ADMIN_ONLY'>('PUBLIC');
  const [editingSocialLinks, setEditingSocialLinks] = useState(false);
  const [editSocialLinks, setEditSocialLinks] = useState<Record<string, string>>({});
  const [editSocialLinksVisibility, setEditSocialLinksVisibility] = useState<'PUBLIC' | 'ADMIN_ONLY'>('PUBLIC');
  const [savingSocialLinks, setSavingSocialLinks] = useState(false);

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
      loadDepositLimits();
      loadWithdrawals();
      loadProfileDetails();
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

  // Deposit invoice countdown
  useEffect(() => {
    if (!depositData || depositStatus !== 'pending') return;

    const updateCountdown = () => {
      const msRemaining = new Date(depositData.expiresAt).getTime() - Date.now();
      if (msRemaining <= 0) {
        setDepositCountdown('expired');
        return;
      }

      const minutes = Math.floor(msRemaining / 60000);
      const seconds = Math.floor((msRemaining % 60000) / 1000);
      setDepositCountdown(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [depositData, depositStatus]);

  // Poll for deposit status when invoice is shown
  useEffect(() => {
    if (!depositData || depositStatus !== 'pending') return;

    const pollInterval = setInterval(async () => {
      try {
        const status = await balanceAPI.getDepositStatus(depositData.id);
        if (status.status === 'SETTLED') {
          setDepositStatus('settled');
          setLightningBalance(status.balanceSats);
          setSaveMessage({ type: 'success', text: `${status.amountSats.toLocaleString()} sats deposited successfully!` });
          loadBalance();
          setTimeout(() => {
            setShowDepositModal(false);
            setDepositData(null);
            setDepositStatus('amount');
          }, 3000);
        } else if (status.status === 'EXPIRED') {
          setDepositStatus('expired');
        } else if (status.status === 'FAILED') {
          setDepositStatus('failed');
        }
      } catch (err) {
        console.error('Failed to poll deposit status:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [depositData, depositStatus]);

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
            loadWithdrawals();
          }, 3000);
        } else if (status.status === 'CANCELLED') {
          setWithdrawalData(null);
          setWithdrawalStatus('PENDING');
          setSaveMessage({ type: 'success', text: 'Withdrawal cancelled and balance returned.' });
          loadBalance();
          loadWithdrawals();
        } else if (status.status === 'FAILED' || status.status === 'EXPIRED') {
          setWithdrawalStatus(status.status as 'FAILED' | 'EXPIRED');
          loadBalance();
          loadWithdrawals();
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
          setSaveMessage({ type: 'success', text: 'Phoenix login linked successfully!' });
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
        setSaveMessage({ type: 'error', text: err.message || 'Failed to link Phoenix login' });
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

  const loadDepositLimits = async () => {
    try {
      const limits = await balanceAPI.getDepositLimits();
      setDepositLimits(limits);
      setDepositAmountInput(prev => prev || Math.min(10000, limits.maxDepositSats).toString());
    } catch (err) {
      console.error('Failed to load deposit limits:', err);
    }
  };

  const resetDepositFlow = () => {
    setDepositData(null);
    setDepositStatus('amount');
    setDepositError('');
    setDepositCountdown('');
  };

  const handleCreateDeposit = async () => {
    const amountSats = parseInt(depositAmountInput.replace(/,/g, ''), 10);
    if (!Number.isInteger(amountSats)) {
      setDepositError('Enter a whole number of sats');
      return;
    }
    if (amountSats < depositLimits.minDepositSats) {
      setDepositError(`Minimum deposit is ${depositLimits.minDepositSats.toLocaleString()} sats`);
      return;
    }
    if (amountSats > depositLimits.maxDepositSats) {
      setDepositError(`Maximum deposit is ${depositLimits.maxDepositSats.toLocaleString()} sats`);
      return;
    }

    setDepositing(true);
    setDepositError('');
    try {
      const result = await balanceAPI.deposit(amountSats);
      setDepositData({
        id: result.deposit.id,
        paymentRequest: result.paymentRequest,
        qrData: result.qrData,
        lightningUri: result.lightningUri,
        amountSats: result.deposit.amountSats,
        expiresAt: result.deposit.expiresAt,
      });
      setDepositStatus('pending');
    } catch (err: any) {
      setDepositError(err.message || 'Failed to create deposit invoice');
      setDepositStatus('error');
    } finally {
      setDepositing(false);
    }
  };

  const loadWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const data = await withdrawalsAPI.getMy();
      setMyWithdrawals(data);

      const pending = data.find((w: any) => w.status === 'PENDING');
      if (pending && !withdrawalData) {
        try {
          const full = await withdrawalsAPI.getMyById(pending.id);
          if (full?.status === 'PENDING' && full.qrData && full.lightningUri) {
            setWithdrawalData({
              id: full.id,
              lnurl: full.lnurl,
              qrData: full.qrData,
              lightningUri: full.lightningUri,
              amountSats: full.amountSats,
            });
            setWithdrawalStatus('PENDING');
          }
        } catch (err) {
          console.error('Failed to load pending withdrawal QR:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load withdrawals:', err);
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const handleCancelWithdrawal = async () => {
    if (!withdrawalData || cancellingWithdrawal) return;
    setCancellingWithdrawal(true);
    setSaveMessage(null);
    try {
      const result = await balanceAPI.cancelWithdrawal(withdrawalData.id);
      setLightningBalance(result.balanceSats);
      setWithdrawalData(null);
      setWithdrawalStatus('PENDING');
      setSaveMessage({ type: 'success', text: 'Withdrawal cancelled and balance returned.' });
      await loadWithdrawals();
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to cancel withdrawal' });
      await loadWithdrawals();
    } finally {
      setCancellingWithdrawal(false);
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

  const loadProfileDetails = async () => {
    setLoadingDetails(true);
    try {
      const data = await authAPI.getProfileDetails();
      setBio(data.profile?.bio || '');
      setProfileImage(data.profile?.profileImage || null);
      setTelegramUsername(data.profile?.telegramUsername || '');
      setTelegramVerified(data.profile?.telegramVerified ?? false);
      setTelegramVisibility(data.profile?.telegramVisibility || 'ADMIN_ONLY');
      setNostrPubkey(data.profile?.nostrPubkey || '');
      setNostrVisibility(data.profile?.nostrVisibility || 'ADMIN_ONLY');
      setSocialLinksVisibility(data.profile?.socialLinksVisibility || 'ADMIN_ONLY');
      // Load social links
      if (data.profile?.socialLinks) {
        const links = typeof data.profile.socialLinks === 'string' ? JSON.parse(data.profile.socialLinks) : data.profile.socialLinks;
        setSocialLinks(links);
      }
    } catch (err) {
      console.error('Failed to load profile details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    setSaveMessage(null);
    try {
      const tg = editTelegramUsername.replace(/^@/, '').trim() || null;
      const nostr = editNostrPubkey.trim() || null;
      const data = await authAPI.updateProfileDetails({
        bio: editBio,
        profileImage: editProfileImage,
        telegramUsername: tg,
        telegramVisibility: editTelegramVisibility,
        nostrPubkey: nostr,
        nostrVisibility: editNostrVisibility,
      });
      setBio(data.profile?.bio || '');
      setProfileImage(data.profile?.profileImage || null);
      setTelegramUsername(data.profile?.telegramUsername || '');
      setTelegramVerified(data.profile?.telegramVerified ?? false);
      setTelegramVisibility(data.profile?.telegramVisibility || 'ADMIN_ONLY');
      setNostrPubkey(data.profile?.nostrPubkey || '');
      setNostrVisibility(data.profile?.nostrVisibility || 'ADMIN_ONLY');
      setEditingDetails(false);
      setSaveMessage({ type: 'success', text: 'Profile details updated!' });
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Failed to save profile details' });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleVerifyTelegram = async () => {
    setVerifyingTelegram(true);
    setSaveMessage(null);
    try {
      const result = await authAPI.verifyTelegram();
      if (result.success) {
        setSaveMessage({ type: 'success', text: result.message || 'Check your Telegram for a verification message!' });
        // Reload profile details to pick up telegramVerified=true
        await loadProfileDetails();
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Verification failed. Make sure you\'ve messaged the bot first.' });
      }
    } catch (err: any) {
      setSaveMessage({ type: 'error', text: err.message || 'Verification failed' });
    } finally {
      setVerifyingTelegram(false);
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
        return '🔵 Connected';
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
      <div className="min-h-screen page-gradient-profile flex items-center justify-center ">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen page-gradient-profile ">
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

      <MobileNav currentPage="dashboard" />

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Back Link */}
        <Link href="/dashboard" className="text-blue-300 hover:text-blue-200 mb-4 md:mb-6 inline-block text-sm md:text-base">
          ← Back to Dashboard
        </Link>

        {/* Name Setup Banner for Lightning Users */}
        {needsRealName && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 mb-6">
            <h3 className="text-yellow-400 font-bold text-lg mb-2">👋 Welcome! Please set your real name</h3>
            <p className="text-yellow-200 text-sm">
              Tournament directors need to identify players by name. Please enter your real name below - 
              <strong> this can only be set once</strong>, so make sure it's correct!
            </p>
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6 mb-6">
          {!isEditing ? (
            <>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl md:text-4xl font-bold flex-shrink-0 overflow-hidden">
                  {profileImage || user.avatar ? (
                    <img src={(profileImage || user.avatar)!} alt={user.name} className="w-full h-full rounded-full object-cover" />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl md:text-3xl font-bold text-white">{user.name}</h1>
                  <p className="text-blue-100">{user.email || 'No email set'}</p>
                  <p className="text-blue-300 text-sm mt-1">
                    Logged in with {getAuthBadge()} • {user.role}
                  </p>
                  {nameIsLocked && (
                    <p className="text-blue-300 text-xs mt-1">✓ Name verified</p>
                  )}
                </div>
                {!nameIsLocked && (
                  <button
                    onClick={startEditing}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition text-sm md:text-base w-full sm:w-auto"
                  >
                    ✏️ Edit Profile
                  </button>
                )}
              </div>

              {saveMessage && (
                <div className={`mt-4 p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-400'}`}>
                  {saveMessage.text}
                </div>
              )}

              {/* Admin badge if already admin */}
              {user.role === 'ADMIN' && (
                <div className="mt-6 pt-6 border-t border-blue-600/30 flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
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
                  <label className="block text-blue-100 text-sm mb-1">
                    {needsRealName ? 'Your Real Name *' : 'Display Name *'}
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-500"
                    placeholder={needsRealName ? "Enter your real name (e.g., John Smith)" : "Your display name"}
                    autoFocus={needsRealName}
                  />
                  {needsRealName && (
                    <p className="text-yellow-400 text-sm mt-1">
                      ⚠️ This can only be set once! Use your real name so tournament directors can identify you.
                    </p>
                  )}
                  {nameIsLocked && (
                    <p className="text-blue-300 text-sm mt-1">
                      ✓ Your name has been set and cannot be changed.
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-blue-100 text-sm mb-1">
                    Email {!user.email && <span className="text-yellow-400">(not set)</span>}
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-500"
                    placeholder="your@email.com"
                  />
                  {user.authProvider === 'LIGHTNING' && !user.email && (
                    <p className="text-yellow-400 text-sm mt-1">
                      💡 Adding an email lets you recover your account and receive notifications
                    </p>
                  )}
                </div>

                {saveMessage && (
                  <div className={`p-3 rounded-lg ${saveMessage.type === 'success' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-400'}`}>
                    {saveMessage.text}
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition w-full sm:w-auto"
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

        {/* About Me Card - Profile Image & Bio */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white">📝 About Me</h2>
            {!editingDetails && (
              <button
                onClick={() => {
                  setEditBio(bio);
                  setEditProfileImage(profileImage);
                  setEditTelegramUsername(telegramUsername);
                  setEditTelegramVisibility(telegramVisibility);
                  setEditNostrPubkey(nostrPubkey);
                  setEditNostrVisibility(nostrVisibility);
                  setEditingDetails(true);
                  setSaveMessage(null);
                }}
                className="text-blue-300 hover:text-blue-200 text-sm font-medium"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
            </div>
          ) : editingDetails ? (
            <div className="space-y-4">
              {/* Profile Image Upload */}
              <div>
                <label className="block text-blue-100 text-sm mb-2">Profile Photo</label>
                <div className="flex items-center gap-4">
                  {editProfileImage ? (
                    <div className="relative">
                      <img
                        src={editProfileImage}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-2 border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => setEditProfileImage(null)}
                        className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <label className="w-24 h-24 rounded-full border-2 border-dashed border-gray-500 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-white/5 transition">
                      <span className="text-2xl">📷</span>
                      <span className="text-gray-300 text-[10px]">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith('image/')) return;
                          // Compress to small circular avatar
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement('canvas');
                              const size = Math.min(img.width, img.height, 300);
                              canvas.width = size;
                              canvas.height = size;
                              const ctx = canvas.getContext('2d');
                              if (!ctx) return;
                              // Center crop
                              const sx = (img.width - size) / 2;
                              const sy = (img.height - size) / 2;
                              ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
                              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                              setEditProfileImage(dataUrl);
                            };
                            img.src = ev.target?.result as string;
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                  <p className="text-gray-400 text-xs">Square photo recommended.<br/>Max 500KB after compression.</p>
                </div>
              </div>

              {/* Bio Text */}
              <div>
                <label className="block text-blue-100 text-sm mb-1">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Tell other players a bit about yourself..."
                />
                <p className="text-gray-400 text-xs text-right">{editBio.length}/500</p>
              </div>

              {/* Telegram Username */}
              <div>
                <label className="block text-blue-100 text-sm mb-1">
                  Telegram Username <span className="text-blue-300 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-300 font-medium">@</span>
                  <input
                    type="text"
                    value={editTelegramUsername}
                    onChange={(e) => setEditTelegramUsername(e.target.value.replace(/^@/, ''))}
                    className="w-full pl-7 pr-3 py-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/30 focus:outline-none focus:border-blue-500"
                    placeholder="yourusername"
                    maxLength={50}
                  />
                </div>
                <p className="text-blue-300 text-xs mt-1">Used to send you event updates via Telegram.</p>
              </div>

              {/* Telegram Visibility */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Telegram Visibility</p>
                  <p className="text-blue-300 text-xs mt-0.5">
                    {editTelegramVisibility === 'PUBLIC' ? 'Visible to everyone on your public profile' : 'Only visible to admins'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditTelegramVisibility(v => v === 'PUBLIC' ? 'ADMIN_ONLY' : 'PUBLIC')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editTelegramVisibility === 'PUBLIC' ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editTelegramVisibility === 'PUBLIC' ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {editTelegramVisibility === 'ADMIN_ONLY' && (
                <p className="text-orange-400 text-xs -mt-1">🔒 Admin only — your Telegram won't show on your public profile</p>
              )}

              {/* Nostr Public Key */}
              <div>
                <label className="block text-blue-100 text-sm mb-1">
                  Nostr Public Key <span className="text-blue-300 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editNostrPubkey}
                  onChange={(e) => setEditNostrPubkey(e.target.value.trim())}
                  className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/30 focus:outline-none focus:border-blue-500 font-mono text-xs"
                  placeholder="npub1... or hex pubkey"
                  maxLength={200}
                />
                <p className="text-blue-300 text-xs mt-1">Your Nostr npub or hex public key.</p>
              </div>

              {/* Nostr Visibility */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Nostr Key Visibility</p>
                  <p className="text-blue-300 text-xs mt-0.5">
                    {editNostrVisibility === 'PUBLIC' ? 'Visible to everyone on your public profile' : 'Only visible to admins'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditNostrVisibility(v => v === 'PUBLIC' ? 'ADMIN_ONLY' : 'PUBLIC')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editNostrVisibility === 'PUBLIC' ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editNostrVisibility === 'PUBLIC' ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {editNostrVisibility === 'ADMIN_ONLY' && (
                <p className="text-orange-400 text-xs -mt-1">🔒 Admin only — your Nostr key won't show on your public profile</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSaveDetails}
                  disabled={savingDetails}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-5 py-2 rounded-lg font-medium transition text-sm"
                >
                  {savingDetails ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingDetails(false)}
                  disabled={savingDetails}
                  className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-lg font-medium transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-4">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-blue-600/50 flex-shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-white/5 border-2 border-dashed border-gray-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-gray-300 text-2xl">📷</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {bio ? (
                  <p className="text-blue-100 text-sm whitespace-pre-wrap mb-2">{bio}</p>
                ) : (
                  <p className="text-gray-300 text-sm italic mb-2">No bio yet. Click Edit to add one!</p>
                )}
                {telegramUsername && (
                  <div className="mt-1">
                    <p className="text-blue-300 text-sm flex items-center gap-1 flex-wrap">
                      <span>✈️</span>
                      <a
                        href={`https://t.me/${telegramUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-200 transition"
                      >
                        @{telegramUsername}
                      </a>
                      {telegramVerified ? (
                        <span className="ml-1 text-green-400 text-xs font-medium">✓ Verified</span>
                      ) : (
                        <span className="ml-1 text-yellow-400 text-xs">⚠️ Not verified</span>
                      )}
                      <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-white/10 text-blue-300">
                        {telegramVisibility === 'PUBLIC' ? '🌐 Public' : '🔒 Admin only'}
                      </span>
                    </p>
                    {!telegramVerified && (
                      <div className="mt-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <p className="text-yellow-300 text-xs mb-2">
                          To receive notifications, first message <a href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'CoraTelegramBot'}`} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline">@{process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'CoraTelegramBot'}</a> on Telegram, then click verify.
                        </p>
                        <button
                          onClick={handleVerifyTelegram}
                          disabled={verifyingTelegram}
                          className="inline-flex items-center gap-1 bg-green-600/20 hover:bg-green-600/30 disabled:opacity-50 text-green-300 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                        >
                          {verifyingTelegram ? '⏳ Verifying…' : '✅ Verify Telegram'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {nostrPubkey && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-purple-300 text-sm">⚡ Nostr:</span>
                    <span className="text-purple-200 text-xs font-mono truncate max-w-[180px]">{nostrPubkey}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-blue-300">
                      {nostrVisibility === 'PUBLIC' ? '🌐 Public' : '🔒 Admin only'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Social Links Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white">🔗 Social Links</h2>
            {!editingSocialLinks && (
              <button
                onClick={() => {
                  setEditSocialLinks({ ...socialLinks });
                  setEditSocialLinksVisibility(socialLinksVisibility);
                  setEditingSocialLinks(true);
                  setSaveMessage(null);
                }}
                className="text-blue-300 hover:text-blue-200 text-sm font-medium"
              >
                ✏️ Edit
              </button>
            )}
          </div>

          {editingSocialLinks ? (
            <div className="space-y-3">
              {[
                { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username', icon: '📸' },
                { key: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/username', icon: '🐦' },
                { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/username', icon: '👤' },
                { key: 'hendonmob', label: 'Hendon Mob', placeholder: 'https://pokerdb.thehendonmob.com/player...', icon: '🃏' },
                { key: 'website', label: 'Website', placeholder: 'https://yoursite.com', icon: '🌐' },
              ].map(({ key, label, placeholder, icon }) => (
                <div key={key}>
                  <label className="block text-blue-100 text-sm mb-1">{icon} {label}</label>
                  <input
                    type="url"
                    value={editSocialLinks[key] || ''}
                    onChange={(e) => setEditSocialLinks({ ...editSocialLinks, [key]: e.target.value })}
                    className="w-full p-2.5 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/30 focus:outline-none focus:border-blue-500 text-sm"
                    placeholder={placeholder}
                  />
                </div>
              ))}
              {/* Social Links Visibility */}
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg mt-2">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Social Links Visibility</p>
                  <p className="text-blue-300 text-xs mt-0.5">
                    {editSocialLinksVisibility === 'PUBLIC' ? 'Visible to everyone on your public profile' : 'Only visible to admins'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditSocialLinksVisibility(v => v === 'PUBLIC' ? 'ADMIN_ONLY' : 'PUBLIC')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editSocialLinksVisibility === 'PUBLIC' ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editSocialLinksVisibility === 'PUBLIC' ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              {editSocialLinksVisibility === 'ADMIN_ONLY' && (
                <p className="text-orange-400 text-xs">🔒 Admin only — your social links won't show on your public profile</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    setSavingSocialLinks(true);
                    setSaveMessage(null);
                    try {
                      // Filter out empty links
                      const filtered: Record<string, string> = {};
                      Object.entries(editSocialLinks).forEach(([k, v]) => {
                        if (v && v.trim()) filtered[k] = v.trim();
                      });
                      await authAPI.updateProfileDetails({ bio, profileImage, socialLinks: filtered, socialLinksVisibility: editSocialLinksVisibility });
                      setSocialLinks(filtered);
                      setSocialLinksVisibility(editSocialLinksVisibility);
                      setEditingSocialLinks(false);
                      setSaveMessage({ type: 'success', text: 'Social links updated!' });
                    } catch (err: any) {
                      setSaveMessage({ type: 'error', text: err.message || 'Failed to save social links' });
                    } finally {
                      setSavingSocialLinks(false);
                    }
                  }}
                  disabled={savingSocialLinks}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-5 py-2 rounded-lg font-medium transition text-sm"
                >
                  {savingSocialLinks ? 'Saving...' : 'Save Links'}
                </button>
                <button
                  onClick={() => setEditingSocialLinks(false)}
                  disabled={savingSocialLinks}
                  className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-lg font-medium transition text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {Object.keys(socialLinks).length === 0 ? (
                <p className="text-gray-300 text-sm italic">No social links added yet. Click Edit to add yours!</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {socialLinks.instagram && (
                    <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-lg text-white hover:from-purple-600/50 hover:to-pink-600/50 transition text-sm">
                      📸 Instagram
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a href={socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 rounded-lg text-white hover:bg-blue-500/40 transition text-sm">
                      🐦 X / Twitter
                    </a>
                  )}
                  {socialLinks.facebook && (
                    <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-blue-700/30 rounded-lg text-white hover:bg-blue-700/50 transition text-sm">
                      👤 Facebook
                    </a>
                  )}
                  {socialLinks.hendonmob && (
                    <a href={socialLinks.hendonmob} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-green-600/20 rounded-lg text-white hover:bg-green-600/40 transition text-sm">
                      🃏 Hendon Mob
                    </a>
                  )}
                  {socialLinks.website && (
                    <a href={socialLinks.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition text-sm">
                      🌐 Website
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Linked Login Methods Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6 mb-6">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">🔐 Login Methods</h2>
          
          <div className="space-y-3">
            {/* Email/Password Status */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✉️</span>
                <div>
                  <p className="text-white font-medium">Email & Password</p>
                  <p className="text-blue-300 text-sm">
                    {user.email && user.authProvider !== 'LIGHTNING' ? user.email : 
                     user.email && user.authProvider === 'LIGHTNING' ? user.email : 'Not configured'}
                  </p>
                </div>
              </div>
              {user.email && user.authProvider !== 'LIGHTNING' ? (
                <span className="text-blue-300 text-sm">✓ Linked</span>
              ) : user.authProvider === 'LIGHTNING' && !user.email ? (
                <button
                  onClick={() => setShowAddEmail(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition"
                >
                  + Add Email
                </button>
              ) : user.authProvider === 'LIGHTNING' && user.email ? (
                <span className="text-blue-300 text-sm">✓ Linked</span>
              ) : null}
            </div>

            {/* Lightning Status */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="text-white font-medium">Phoenix Login</p>
                  <p className="text-blue-300 text-sm">
                    {user.lightningPubkey ? `${user.lightningPubkey.slice(0, 8)}...${user.lightningPubkey.slice(-8)}` : 'Not connected'}
                  </p>
                </div>
              </div>
              {user.lightningPubkey ? (
                <span className="text-blue-300 text-sm">✓ Linked</span>
              ) : (
                <button
                  onClick={async () => {
                    setLinkingLightning(true);
                    setLinkLightningStatus('pending');
                    try {
                      const challenge = await authAPI.linkLightningChallenge();
                      setLinkLightningData({ k1: challenge.k1, lnurl: challenge.lnurl, qrCode: challenge.qrCode });
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
                  {linkingLightning ? '...' : '📱 Link Phoenix'}
                </button>
              )}
            </div>
          </div>

          {/* Link Phoenix Login Modal */}
          {linkLightningData && linkLightningStatus === 'pending' && (
            <div className="mt-4 p-4 bg-black/30 rounded-lg">
              <h3 className="text-white font-bold mb-2 text-center">📱 Link Phoenix Login</h3>
              <p className="text-yellow-400 text-sm text-center mb-4">
                Tap the button below, approve the login in Phoenix, then come back here.
              </p>
              <div className="flex flex-col items-center gap-4">
                <a
                  href={`phoenix:lightning:${linkLightningData.lnurl}`}
                  className="w-full max-w-xs text-center bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-lg px-6 py-4 rounded-xl shadow-lg shadow-orange-900/40 transition active:scale-[0.98]"
                >
                  📱 Open Phoenix and Link
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(linkLightningData.lnurl);
                    setCopiedLinkLnurl(true);
                    setTimeout(() => setCopiedLinkLnurl(false), 2000);
                  }}
                  className="text-blue-300 hover:text-blue-200 underline underline-offset-2 text-sm"
                >
                  {copiedLinkLnurl ? '✅ Copied!' : '📋 Copy login code'}
                </button>
                <div className="hidden sm:flex flex-col items-center gap-2">
                  <p className="text-gray-400 text-xs text-center">Desktop option: scan with Phoenix.</p>
                  <div className="bg-white p-4 rounded-lg">
                    <img src={linkLightningData.qrCode} alt="Link Phoenix QR" className="w-48 h-48" />
                  </div>
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
                  <label className="block text-blue-100 text-sm mb-1">Email</label>
                  <input
                    type="email"
                    value={addEmailData.email}
                    onChange={(e) => setAddEmailData({ ...addEmailData, email: e.target.value })}
                    className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-500"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-blue-100 text-sm mb-1">Password</label>
                  <input
                    type="password"
                    value={addEmailData.password}
                    onChange={(e) => setAddEmailData({ ...addEmailData, password: e.target.value })}
                    className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-500"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label className="block text-blue-100 text-sm mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={addEmailData.confirmPassword}
                    onChange={(e) => setAddEmailData({ ...addEmailData, confirmPassword: e.target.value })}
                    className="w-full p-3 bg-white/10 border border-blue-600/50 rounded-lg text-white placeholder-blue-200/50 focus:outline-none focus:border-blue-500"
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
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg font-medium transition"
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
                {lightningBalance === 0 && (
                  <p className="text-yellow-200 text-sm mt-1">Deposit sats to join side bets or keep a balance on site.</p>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button
                  onClick={() => {
                    resetDepositFlow();
                    setShowDepositModal(true);
                  }}
                  className="bg-orange-500 hover:bg-orange-600 text-black font-bold px-6 py-3 rounded-lg transition w-full md:w-auto"
                >
                  ⚡ Deposit
                </button>
                {lightningBalance > 0 && !withdrawalData && (
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing || lightningBalance < 100}
                    className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold px-6 py-3 rounded-lg transition w-full md:w-auto"
                  >
                    {withdrawing ? '⏳ Processing...' : '⚡ Withdraw All'}
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Deposit Modal */}
          {showDepositModal && (
            <div className="mt-4 p-4 bg-black/30 rounded-lg border border-orange-500/30">
              {depositStatus === 'pending' && depositData ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="text-center">
                    <h3 className="text-white font-bold text-lg">⚡ Send {depositData.amountSats.toLocaleString()} sats</h3>
                    <p className="text-yellow-200 text-sm mt-1">
                      Your balance updates automatically after payment.
                    </p>
                    <p className="text-orange-300 text-xs mt-1">
                      Expires in {depositCountdown || '...'}
                    </p>
                  </div>
                  <div className="bg-white p-4 rounded-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(depositData.qrData)}`}
                      alt="Deposit invoice QR Code"
                      className="w-52 h-52"
                    />
                  </div>
                  <InvoiceActions value={depositData.paymentRequest} />
                  <div className="flex items-center gap-2 text-yellow-200 text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                    Waiting for payment...
                  </div>
                  <p className="text-gray-300 text-xs text-center max-w-md">
                    You can safely close this page after paying; we’ll still credit your balance once the invoice confirms.
                  </p>
                  <button
                    onClick={() => {
                      setShowDepositModal(false);
                      resetDepositFlow();
                    }}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    ✕ Close
                  </button>
                </div>
              ) : depositStatus === 'settled' && depositData ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-4xl">✅</div>
                  <h3 className="text-green-300 font-bold text-xl text-center">Deposit received!</h3>
                  <p className="text-green-100 text-center">
                    {depositData.amountSats.toLocaleString()} sats added to your balance.
                  </p>
                </div>
              ) : depositStatus === 'expired' || depositStatus === 'failed' ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-4xl">⚠️</div>
                  <h3 className="text-red-300 font-bold text-xl text-center">
                    Deposit {depositStatus === 'expired' ? 'expired' : 'failed'}
                  </h3>
                  <p className="text-red-100 text-center">No sats were credited. Create a new invoice to try again.</p>
                  <button
                    onClick={resetDepositFlow}
                    className="bg-orange-500 hover:bg-orange-600 text-black font-bold px-4 py-2 rounded-lg transition"
                  >
                    Create New Invoice
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-white font-bold text-lg">⚡ Deposit with Lightning</h3>
                      <p className="text-yellow-200 text-sm">Choose an amount and pay with Phoenix.</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowDepositModal(false);
                        resetDepositFlow();
                      }}
                      className="text-gray-400 hover:text-white text-xl"
                      aria-label="Close deposit modal"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
                    {[1000, 5000, 10000, 25000, 50000].map(amount => (
                      <button
                        key={amount}
                        onClick={() => setDepositAmountInput(amount.toString())}
                        className={`px-3 py-2 rounded-lg font-bold transition ${
                          parseInt(depositAmountInput, 10) === amount
                            ? 'bg-orange-500 text-black'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {amount.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  <label className="block text-yellow-100 text-sm mb-1">Custom amount, sats</label>
                  <input
                    type="number"
                    min={depositLimits.minDepositSats}
                    max={depositLimits.maxDepositSats}
                    value={depositAmountInput}
                    onChange={(e) => {
                      setDepositAmountInput(e.target.value);
                      setDepositError('');
                    }}
                    className="w-full p-3 bg-white/10 border border-yellow-500/40 rounded-lg text-white placeholder-yellow-200/50 focus:outline-none focus:border-yellow-400"
                    placeholder="10000"
                  />
                  <p className="text-yellow-200 text-xs mt-2">
                    Min {depositLimits.minDepositSats.toLocaleString()} sats · Max {depositLimits.maxDepositSats.toLocaleString()} sats · Invoice expires in {Math.round(depositLimits.invoiceExpirySeconds / 60)} minutes.
                  </p>
                  {depositError && (
                    <p className="text-red-300 text-sm mt-3">⚠️ {depositError}</p>
                  )}
                  <button
                    onClick={handleCreateDeposit}
                    disabled={depositing}
                    className="mt-4 w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold px-6 py-3 rounded-lg transition"
                  >
                    {depositing ? '⏳ Generating Invoice...' : 'Generate Lightning Invoice'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Withdrawal QR Code Modal */}
          {withdrawalData && (
            <div className="mt-4 p-4 bg-black/30 rounded-lg">
              {withdrawalStatus === 'PAID' ? (
                // Success state
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-4xl">✅</div>
                  <h3 className="text-blue-300 font-bold text-xl text-center">
                    Withdrawal Complete!
                  </h3>
                  <p className="text-blue-100 text-center">
                    {withdrawalData.amountSats.toLocaleString()} sats ready to collect in Phoenix
                  </p>
                </div>
              ) : withdrawalStatus === 'FAILED' || withdrawalStatus === 'EXPIRED' ? (
                // Failed/Expired state
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="text-4xl">❌</div>
                  <h3 className="text-red-400 font-bold text-xl text-center">
                    Withdrawal {withdrawalStatus === 'EXPIRED' ? 'Expired' : 'Failed'}
                  </h3>
                  <p className="text-red-200 text-center">
                    Your balance has been returned to your account.
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
                    ⚡ Pending Withdrawal: {withdrawalData.amountSats.toLocaleString()} sats
                  </h3>
                  <p className="text-yellow-400 text-xs text-center mb-4">
                    Your balance is reserved for this cashout. Open Phoenix to collect it, or cancel below to return the sats to your site balance.
                  </p>
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-4 rounded-lg">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(withdrawalData.qrData)}`}
                        alt="Withdrawal QR Code" 
                        className="w-48 h-48"
                      />
                    </div>
                    <div className="text-center w-full">
                      <p className="text-yellow-200 text-sm mb-2">
                        Open Phoenix to collect, or scan this QR from another device:
                      </p>
                      <InvoiceActions value={withdrawalData.qrData} copyLabel="Copy Withdraw Code" />
                    </div>
                    <div className="text-center text-xs text-gray-300 mt-2">
                      <p>If you don't complete the withdrawal, you can cancel it now or it will be refunded when it expires (24 hours).</p>
                    </div>
                    <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-center max-w-xs">
                      <p className="text-yellow-300 text-xs font-medium mb-1">📱 Phoenix</p>
                      <p className="text-yellow-200 text-xs">Tap <strong className="text-yellow-300">SEND</strong> first, then scan this QR code to receive your sats.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 mt-2">
                      <button
                        onClick={handleCancelWithdrawal}
                        disabled={cancellingWithdrawal}
                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold px-4 py-2 rounded-lg transition"
                      >
                        {cancellingWithdrawal ? 'Cancelling...' : 'Cancel Cashout & Return Balance'}
                      </button>
                      <button
                        onClick={() => {
                          setWithdrawalData(null);
                          setWithdrawalStatus('PENDING');
                          loadBalance();
                        }}
                        className="text-gray-400 hover:text-white text-sm px-4 py-2"
                      >
                        ✕ Close
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          
          <p className="text-yellow-200 text-xs mt-4 text-center">
            💡 Winnings are credited to your balance. Withdraw anytime with Phoenix!
          </p>
        </div>

        {/* Withdrawal History */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg md:text-xl font-bold text-white">📋 Withdrawal History</h2>
            <button
              onClick={loadWithdrawals}
              className="text-blue-300 hover:text-blue-200 text-sm"
            >
              🔄 Refresh
            </button>
          </div>

          {loadingWithdrawals ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
            </div>
          ) : myWithdrawals.length === 0 ? (
            <p className="text-blue-300 text-center py-6 text-sm">No withdrawals yet</p>
          ) : (
            <div className="space-y-2">
              {myWithdrawals.slice(0, 20).map((w: any) => (
                <div key={w.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg flex-shrink-0">
                      {w.status === 'PAID' ? '✅' : w.status === 'PENDING' ? '⏳' : w.status === 'CLAIMED' ? '📥' : w.status === 'EXPIRED' ? '⏰' : '❌'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm">
                        {w.amountSats?.toLocaleString() || '—'} sats
                      </p>
                      <p className="text-blue-300 text-xs truncate">
                        {new Date(w.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${
                    w.status === 'PAID' ? 'bg-blue-500/20 text-blue-300' :
                    w.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400' :
                    w.status === 'CLAIMED' ? 'bg-blue-500/20 text-blue-400' :
                    w.status === 'EXPIRED' ? 'bg-gray-500/20 text-gray-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referral Program */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6 mb-6">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">🎯 Referral Program</h2>
          <ReferralTab />
        </div>

        {/* My Side Bets */}
        <SideBetsSection />

        {/* Season Points Card */}
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur rounded-xl border border-yellow-500/30 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                🏆 Season Points
              </h2>
              {seasonStanding?.season && (
                <p className="text-yellow-200 text-sm">{seasonStanding.season.name}</p>
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
            <p className="text-yellow-200 text-center py-4">No active season</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-yellow-400">
                  {seasonStanding.standing?.totalPoints || 0}
                </p>
                <p className="text-yellow-200 text-xs">Points</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-white">
                  {seasonStanding.standing?.rank ? `#${seasonStanding.standing.rank}` : '-'}
                </p>
                <p className="text-yellow-200 text-xs">Rank</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-white">
                  {seasonStanding.standing?.eventsPlayed || 0}
                </p>
                <p className="text-yellow-200 text-xs">Events</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-blue-300">
                  {seasonStanding.standing?.wins || 0}
                </p>
                <p className="text-yellow-200 text-xs">Wins</p>
              </div>
              <div className="bg-black/20 rounded-lg p-3 text-center">
                <p className="text-2xl md:text-3xl font-bold text-orange-400">
                  {seasonStanding.standing?.knockouts || 0}
                </p>
                <p className="text-yellow-200 text-xs">KOs</p>
              </div>
            </div>
          )}
        </div>

        {/* All-Time Stats */}
        <h3 className="text-white font-semibold mb-3 text-sm">All-Time Stats</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-blue-300">{stats.totalPoints}</p>
            <p className="text-blue-100 text-xs md:text-sm">Total Points</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-white">{stats.eventsPlayed}</p>
            <p className="text-blue-100 text-xs md:text-sm">Events Played</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-yellow-400">{stats.wins}</p>
            <p className="text-blue-100 text-xs md:text-sm">Wins</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-3 md:p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-orange-400">{stats.topThrees}</p>
            <p className="text-blue-100 text-xs md:text-sm">Top 3 Finishes</p>
          </div>
        </div>

        {/* Event History */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-4 md:p-6">
          <h2 className="text-lg md:text-xl font-bold text-white mb-4">📅 Event History</h2>
          
          {loadingEvents ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            </div>
          ) : myEvents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-blue-300">No events yet</p>
              <Link href="/events" className="text-blue-300 hover:underline mt-2 inline-block">
                Browse upcoming events →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.slug || event.id}`}
                  className="block p-3 md:p-4 bg-white/5 rounded-lg hover:bg-white/10 transition"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-white font-medium text-sm md:text-base truncate">{event.name}</h3>
                      <p className="text-blue-300 text-xs md:text-sm truncate">
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
                          <p className="text-blue-300 text-xs md:text-sm">{event.results[0].pointsEarned} pts</p>
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
