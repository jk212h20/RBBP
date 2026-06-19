'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import MobileNav from '@/components/MobileNav';
import RegistrantsPanel from '@/components/RegistrantsPanel';
import { eventsAPI, sideBetsAPI } from '@/lib/api';

interface EventDetail {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  dateTime: string;
  maxPlayers: number;
  buyInSats?: number | null;
  prepayDiscountSats?: number | null;
  prepayDiscountHours?: number;
  registrationCloseMinutes?: number;
  status: string;
  venue: {
    id: string;
    name: string;
    address: string;
    phone?: string;
    imageUrl?: string;
  };
  season: {
    id: string;
    name: string;
  };
  director?: {
    id: string;
    name: string;
  };
  signups: {
    id: string;
    status: string;
    registeredAt: string;
    checkedInAt?: string;
    user: {
      id: string;
      name: string;
      avatar?: string;
      profile?: {
        profileImage?: string;
      };
    };
  }[];
  results: {
    id: string;
    position: number;
    knockouts: number;
    pointsEarned: number;
    user: {
      id: string;
      name: string;
      avatar?: string;
      profile?: {
        profileImage?: string;
      };
    };
  }[];
  totalEntrants?: number | null;
  _count: {
    signups: number;
    results: number;
    comments: number;
  };
}

interface PlayerResult {
  userId: string;
  name: string;
  attended: boolean;
  position: number | null;
  knockouts: number;
  pointsEarned: number | null;
}

interface ExtraPlayerSlot {
  id: string; // unique key for React
  userId: string | null;
  name: string;
  attended: boolean;
  position: number | null;
  knockouts: number;
  pointsEarned: number | null;
  // search state
  searchQuery: string;
  searchResults: { id: string; name: string; email: string | null; isGuest: boolean }[];
  searchLoading: boolean;
}

interface PointsPreview {
  first: number;
  second: number;
  third: number;
  totalPool: number;
  playerCount: number;
}

interface EventSideBet {
  id: string;
  label: string;
  entrySats: number;
  entryCount: number;
  totalPot: number;
  status: string;
  entries?: { userId: string; userName: string; entryCount: number; paidAt: string | null }[];
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSignedUp, setIsSignedUp] = useState(false);
  const [userSignupStatus, setUserSignupStatus] = useState<string | null>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const { isAuthenticated, user } = useAuth();

  // Tournament Director state
  const [showManagement, setShowManagement] = useState(true);
  const [playerResults, setPlayerResults] = useState<PlayerResult[]>([]);
  const [savingResults, setSavingResults] = useState(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pointsPreview, setPointsPreview] = useState<PointsPreview | null>(null);

  // Quick Add Player state
  const [quickAddSearch, setQuickAddSearch] = useState('');
  const [quickAddResults, setQuickAddResults] = useState<{ id: string; name: string; email: string | null; isGuest: boolean }[]>([]);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState<'search' | 'guest'>('search');
  const [guestName, setGuestName] = useState('');

  // Total Entrants state
  const [totalEntrantsInput, setTotalEntrantsInput] = useState('');
  const [savingTotalEntrants, setSavingTotalEntrants] = useState(false);
  const [totalEntrantsValue, setTotalEntrantsValue] = useState<number | null>(null);

  // Extra player slots (for unaccounted players when totalEntrants > attended registered)
  const [extraSlots, setExtraSlots] = useState<ExtraPlayerSlot[]>([]);

  // Last Longer Pool state
  const [lastLongerPool, setLastLongerPool] = useState<{
    enabled: boolean;
    seedSats: number;
    entrySats: number;
    totalPot: number;
    entryCount: number;
    entries: { id: string; userId: string; userName: string; paidAt: string }[];
    winnerId: string | null;
    winnerName: string | null;
    userEntry: { id: string; status: string; paidAt: string | null } | null;
  } | null>(null);
  const [lastLongerInvoice, setLastLongerInvoice] = useState<{
    paymentRequest: string;
    paymentHash: string;
    amountSats: number;
    expiresAt: string;
    entryId: string;
  } | null>(null);
  const [lastLongerLoading, setLastLongerLoading] = useState(false);
  const [lastLongerMessage, setLastLongerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>('');
  const [selectingWinner, setSelectingWinner] = useState(false);
  const [paymentPolling, setPaymentPolling] = useState(false);

  // Automatic event side bet state
  const [eventSideBet, setEventSideBet] = useState<EventSideBet | null>(null);
  const [sideBetInvoice, setSideBetInvoice] = useState<{ paymentRequest: string; paymentHash: string; amountSats: number } | null>(null);
  const [sideBetLoading, setSideBetLoading] = useState(false);
  const [sideBetPaid, setSideBetPaid] = useState(false);
  const [sideBetMessage, setSideBetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canManageEvent = user && (user.role === 'ADMIN' || user.role === 'TOURNAMENT_DIRECTOR' || user.role === 'VENUE_MANAGER');

  const loadEventSideBet = async (actualEventId = event?.id) => {
    if (!actualEventId) return;
    try {
      const bets = await sideBetsAPI.listOpen(actualEventId);
      if (bets.length > 0) {
        const detail = await sideBetsAPI.getById(bets[0].id);
        setEventSideBet(detail);
      } else {
        setEventSideBet(null);
      }
    } catch (err) {
      console.error('Failed to load event side bet:', err);
      setEventSideBet(null);
    }
  };

  // Load Last Longer Pool data and automatic side bet data
  useEffect(() => {
    if (event) {
      eventsAPI.getLastLongerPool(eventId).then(data => {
        setLastLongerPool(data);
        if (data.winnerId) setSelectedWinnerId(data.winnerId);
      }).catch(() => setLastLongerPool(null));
      loadEventSideBet(event.id);
    }
  }, [event, eventId]);

  // Poll for payment status when invoice is shown
  useEffect(() => {
    if (!lastLongerInvoice || !paymentPolling) return;
    const interval = setInterval(async () => {
      try {
        const result = await eventsAPI.checkLastLongerPayment(eventId, lastLongerInvoice.entryId);
        if (result.paid) {
          setPaymentPolling(false);
          setLastLongerInvoice(null);
          setLastLongerMessage({ type: 'success', text: 'Payment received! You are in the Last Longer pool.' });
          // Reload pool data
          const data = await eventsAPI.getLastLongerPool(eventId);
          setLastLongerPool(data);
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [lastLongerInvoice, paymentPolling, eventId]);

  const handleEnterLastLonger = async () => {
    setLastLongerLoading(true);
    setLastLongerMessage(null);
    try {
      const result = await eventsAPI.enterLastLonger(eventId);
      setLastLongerInvoice({
        ...result.invoice,
        entryId: result.entry.id,
      });
      setPaymentPolling(true);
    } catch (err: any) {
      setLastLongerMessage({ type: 'error', text: err.message || 'Failed to enter Last Longer pool' });
    } finally {
      setLastLongerLoading(false);
    }
  };

  // Poll for automatic side bet payment when a Lightning invoice is displayed
  useEffect(() => {
    if (!sideBetInvoice || sideBetPaid || !eventSideBet) return;
    const interval = setInterval(async () => {
      try {
        const result = await sideBetsAPI.checkPayment(eventSideBet.id);
        if (result.paid) {
          setSideBetPaid(true);
          setSideBetInvoice(null);
          setSideBetMessage({ type: 'success', text: 'Payment received! You are in the event side bet.' });
          await loadEventSideBet();
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [sideBetInvoice, sideBetPaid, eventSideBet]);

  const handleEnterEventSideBet = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!eventSideBet) return;

    setSideBetLoading(true);
    setSideBetMessage(null);
    try {
      const result = await sideBetsAPI.enter(eventSideBet.id);
      if (result.paidWithBalance || !result.invoice) {
        setSideBetInvoice(null);
        setSideBetPaid(true);
        setSideBetMessage({ type: 'success', text: 'Entry paid from your site balance. You are in the event side bet.' });
        await loadEventSideBet();
      } else {
        setSideBetInvoice(result.invoice);
        setSideBetPaid(false);
      }
    } catch (err: any) {
      setSideBetMessage({ type: 'error', text: err.message || 'Failed to enter side bet' });
    } finally {
      setSideBetLoading(false);
    }
  };

  const handleSelectWinner = async () => {
    if (!selectedWinnerId) return;
    setSelectingWinner(true);
    setLastLongerMessage(null);
    try {
      const result = await eventsAPI.selectLastLongerWinner(eventId, selectedWinnerId);
      setLastLongerMessage({ type: 'success', text: `${result.winnerName} wins ${result.prizeAmount.toLocaleString()} sats!` });
      const data = await eventsAPI.getLastLongerPool(eventId);
      setLastLongerPool(data);
    } catch (err: any) {
      setLastLongerMessage({ type: 'error', text: err.message || 'Failed to select winner' });
    } finally {
      setSelectingWinner(false);
    }
  };

  // Calculate extra slots needed when totalEntrants or attendance changes
  // Formula: totalEntrants - attendedRegisteredCount = total extra slots needed
  // Of those, some may already be filled (have a userId), the rest are blank search fields
  useEffect(() => {
    if (totalEntrantsValue === null || !canManageEvent) {
      // Keep result-only rows when editing a completed event; those players may
      // not have an EventSignup record but their results still need correction.
      setExtraSlots(prev => prev.filter(s => s.id.startsWith('result-')));
      return;
    }
    const attendedCount = playerResults.filter(p => p.attended).length;
    // Total extra slots = how many players beyond the registered-attended ones
    const totalExtraNeeded = Math.max(0, totalEntrantsValue - attendedCount);
    
    setExtraSlots(prev => {
      const filledResultSlots = prev.filter(s => s.userId !== null && s.id.startsWith('result-'));
      const otherFilledSlots = prev.filter(s => s.userId !== null && !s.id.startsWith('result-'));
      // Always keep result-only rows when editing completed events. For normal
      // extra slots, keep only as many as the totalEntrants override requires.
      const otherFilledNeeded = Math.max(0, totalExtraNeeded - filledResultSlots.length);
      const keptFilled = [...filledResultSlots, ...otherFilledSlots.slice(0, otherFilledNeeded)];
      const blanksNeeded = Math.max(0, totalExtraNeeded - keptFilled.length);
      
      // Reuse existing blanks where possible, create new ones if needed
      const existingBlanks = prev.filter(s => s.userId === null);
      const keptBlanks = existingBlanks.slice(0, blanksNeeded);
      const newBlanksCount = blanksNeeded - keptBlanks.length;
      const newBlanks = Array.from({ length: newBlanksCount }, (_, i) => ({
        id: `extra-${Date.now()}-${i}`,
        userId: null as string | null,
        name: '',
        attended: true,
        position: null as number | null,
        knockouts: 0,
        pointsEarned: null as number | null,
        searchQuery: '',
        searchResults: [] as { id: string; name: string; email: string | null; isGuest: boolean }[],
        searchLoading: false,
      }));
      
      // Preserve the existing order of filled slots and blanks. Do not sort by
      // position during data entry — that makes the form jump around.
      return [...keptFilled, ...keptBlanks, ...newBlanks];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalEntrantsValue, playerResults, canManageEvent]);

  // Calculate local points preview based on totalEntrants
  useEffect(() => {
    if (totalEntrantsValue !== null && canManageEvent) {
      const extraPlayers = Math.max(0, totalEntrantsValue - 10);
      const totalPool = 10 + (extraPlayers * 2);
      setPointsPreview({
        first: Math.ceil(totalPool * 0.60),
        second: Math.ceil(totalPool * 0.30),
        third: Math.ceil(totalPool * 0.10),
        totalPool,
        playerCount: totalEntrantsValue,
      });
    }
  }, [totalEntrantsValue]);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  useEffect(() => {
    if (event && user) {
      // Check if user is in the signups list (regardless of status)
      const userSignup = event.signups.find(s => s.user.id === user.id);
      setIsSignedUp(!!userSignup);
      setUserSignupStatus(userSignup?.status || null);
      
      // If user is waitlisted, get their position
      if (userSignup?.status === 'WAITLISTED') {
        eventsAPI.getWaitlistPosition(eventId).then(data => {
          setWaitlistPosition(data.position);
        }).catch(console.error);
      } else {
        setWaitlistPosition(null);
      }
    } else if (!user) {
      setIsSignedUp(false);
      setUserSignupStatus(null);
      setWaitlistPosition(null);
    }
  }, [event, user, eventId]);

  // Load points preview when management panel is shown
  useEffect(() => {
    if (showManagement && canManageEvent && event) {
      eventsAPI.getPointsPreview(eventId).then(data => {
        setPointsPreview(data);
      }).catch(console.error);
    }
  }, [showManagement, canManageEvent, event, eventId, playerResults]);

  useEffect(() => {
    // Initialize player results from signups when event loads.
    // Preserve signup order during entry so the form doesn't jump around while
    // positions are being typed. Existing completed results are merged into
    // those fixed rows by user id.
    if (event && canManageEvent) {
      const existingResults = event.results || [];
      const signupUserIds = new Set(event.signups.map(signup => signup.user.id));
      const initialResults: PlayerResult[] = event.signups.map(signup => {
        const existingResult = existingResults.find(r => r.user.id === signup.user.id);
        return {
          userId: signup.user.id,
          name: signup.user.name,
          attended: existingResult ? true : signup.status === 'CHECKED_IN',
          position: existingResult?.position || null,
          knockouts: existingResult?.knockouts || 0,
          pointsEarned: existingResult?.pointsEarned ?? null,
        };
      });
      setPlayerResults(initialResults);

      // If completed results contain unregistered/extra players, keep them
      // editable as fixed extra rows instead of losing them from the form.
      const resultOnlySlots: ExtraPlayerSlot[] = existingResults
        .filter(result => !signupUserIds.has(result.user.id))
        .map(result => ({
          id: `result-${result.id}`,
          userId: result.user.id,
          name: result.user.name,
          attended: true,
          position: result.position,
          knockouts: result.knockouts || 0,
          pointsEarned: result.pointsEarned ?? null,
          searchQuery: '',
          searchResults: [],
          searchLoading: false,
        }));
      if (resultOnlySlots.length > 0) {
        setExtraSlots(resultOnlySlots);
      }

      // Initialize totalEntrantsValue from event data
      if (event.totalEntrants) {
        setTotalEntrantsValue(event.totalEntrants);
        setTotalEntrantsInput(String(event.totalEntrants));
      }
    }
  }, [event, canManageEvent]);

  const loadEvent = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.getById(eventId);
      setEvent(data);
      // If the user landed via a raw cuid, swap the URL to the human-readable slug.
      if (data?.slug && data.slug !== eventId) {
        try {
          window.history.replaceState(null, '', `/events/${data.slug}`);
        } catch {
          // Best-effort prettification — ignore failures (older browsers, etc.)
        }
      }
    } catch (err) {
      setError('Failed to load event');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Buy-in payment modal state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<{
    paymentRequest: string;
    paymentHash: string;
    amountSats: number;
    discountApplied: boolean;
    fullPriceSats: number;
  } | null>(null);
  const [paymentChecking, setPaymentChecking] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [signupBusy, setSignupBusy] = useState(false);

  // For paid events the player chooses Pay Now or Pay on Arrival in a modal.
  // Free events skip the modal entirely.
  const handleSignup = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const hasBuyIn = !!(event && event.buyInSats && event.buyInSats > 0);
    if (hasBuyIn) {
      setPaymentConfirmed(false);
      setPayInvoice(null);
      setPayModalOpen(true);
      return;
    }
    try {
      setSignupBusy(true);
      await eventsAPI.signup(eventId);
      await loadEvent();
    } catch (err: any) {
      alert(err.message || 'Failed to sign up');
    } finally {
      setSignupBusy(false);
    }
  };

  // "Pay Now" branch: create signup + receive invoice + poll until paid.
  const handlePayNow = async () => {
    try {
      setSignupBusy(true);
      const res: any = await eventsAPI.signup(eventId, { payOnArrival: false });
      if (res?.invoice) {
        setPayInvoice(res.invoice);
      } else {
        // Server says the signup is already paid / no invoice needed.
        setPaymentConfirmed(true);
        await loadEvent();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start payment');
      setPayModalOpen(false);
    } finally {
      setSignupBusy(false);
    }
  };

  // "Pay on Arrival" branch: register without creating an invoice.
  const handlePayOnArrival = async () => {
    try {
      setSignupBusy(true);
      await eventsAPI.signup(eventId, { payOnArrival: true });
      setPayModalOpen(false);
      await loadEvent();
    } catch (err: any) {
      alert(err.message || 'Failed to sign up');
    } finally {
      setSignupBusy(false);
    }
  };

  // Poll the server every 3 seconds while the QR is visible.
  useEffect(() => {
    if (!payInvoice || paymentConfirmed) return;
    let cancelled = false;
    const tick = async () => {
      try {
        setPaymentChecking(true);
        const res = await eventsAPI.checkPayment(eventId);
        if (cancelled) return;
        if (res.paid) {
          setPaymentConfirmed(true);
          await loadEvent();
        }
      } catch {
        // ignore transient errors
      } finally {
        if (!cancelled) setPaymentChecking(false);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [payInvoice, paymentConfirmed, eventId]);

  const handleCancelSignup = async () => {
    try {
      await eventsAPI.cancelSignup(eventId);
      loadEvent();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel signup');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await eventsAPI.updateStatus(eventId, newStatus);
      loadEvent();
      setResultMessage({ type: 'success', text: `Event status updated to ${newStatus}` });
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to update status' });
    }
  };

  const toggleAttendance = (userId: string) => {
    setPlayerResults(prev => prev.map(p => 
      p.userId === userId ? { ...p, attended: !p.attended, position: !p.attended ? p.position : null } : p
    ));
  };

  const updatePosition = (userId: string, position: number | null) => {
    setPlayerResults(prev => prev.map(p => 
      p.userId === userId ? { ...p, position } : p
    ));
  };

  const updateKnockouts = (userId: string, knockouts: number) => {
    setPlayerResults(prev => prev.map(p => 
      p.userId === userId ? { ...p, knockouts: Math.max(0, knockouts) } : p
    ));
  };

  const updatePointsEarned = (userId: string, pointsEarned: number | null) => {
    setPlayerResults(prev => prev.map(p =>
      p.userId === userId ? { ...p, pointsEarned: pointsEarned === null ? null : Math.max(0, pointsEarned) } : p
    ));
  };

  // Quick Add Player handlers
  const handleQuickAddSearch = async (query: string) => {
    setQuickAddSearch(query);
    if (query.length < 2) {
      setQuickAddResults([]);
      return;
    }
    setQuickAddLoading(true);
    try {
      const results = await eventsAPI.searchPlayers(eventId, query);
      setQuickAddResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setQuickAddResults([]);
    } finally {
      setQuickAddLoading(false);
    }
  };

  const handleQuickAddExisting = async (userId: string) => {
    try {
      await eventsAPI.quickAddPlayer(eventId, { userId });
      setQuickAddSearch('');
      setQuickAddResults([]);
      setResultMessage({ type: 'success', text: 'Player added!' });
      loadEvent();
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to add player' });
    }
  };

  const handleQuickAddGuest = async () => {
    if (guestName.trim().length < 2) return;
    try {
      await eventsAPI.quickAddPlayer(eventId, { name: guestName.trim() });
      setGuestName('');
      setQuickAddMode('search');
      setResultMessage({ type: 'success', text: `Guest "${guestName.trim()}" added!` });
      loadEvent();
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to add guest' });
    }
  };

  // Total Entrants handler
  const handleSetTotalEntrants = async () => {
    setSavingTotalEntrants(true);
    try {
      const value = totalEntrantsInput.trim() === '' ? null : parseInt(totalEntrantsInput);
      if (value !== null && (isNaN(value) || value < 1)) {
        setResultMessage({ type: 'error', text: 'Total entrants must be a positive number' });
        setSavingTotalEntrants(false);
        return;
      }
      await eventsAPI.setTotalEntrants(eventId, value);
      setTotalEntrantsValue(value);
      if (value === null) {
        setExtraSlots([]);
      }
      setResultMessage({ type: 'success', text: value ? `Total entrants set to ${value}` : 'Total entrants override cleared' });
      loadEvent();
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to set total entrants' });
    } finally {
      setSavingTotalEntrants(false);
    }
  };

  // Extra slot search handler
  const handleExtraSlotSearch = async (slotId: string, query: string) => {
    setExtraSlots(prev => prev.map(s => 
      s.id === slotId ? { ...s, searchQuery: query, searchLoading: query.length >= 2 } : s
    ));
    if (query.length < 2) {
      setExtraSlots(prev => prev.map(s => 
        s.id === slotId ? { ...s, searchResults: [], searchLoading: false } : s
      ));
      return;
    }
    try {
      const results = await eventsAPI.searchPlayers(eventId, query);
      // Filter out players already in playerResults or other extra slots
      const existingIds = new Set([
        ...playerResults.map(p => p.userId),
        ...extraSlots.filter(s => s.userId !== null).map(s => s.userId!),
      ]);
      const filtered = results.filter(r => !existingIds.has(r.id));
      setExtraSlots(prev => prev.map(s => 
        s.id === slotId ? { ...s, searchResults: filtered, searchLoading: false } : s
      ));
    } catch {
      setExtraSlots(prev => prev.map(s => 
        s.id === slotId ? { ...s, searchResults: [], searchLoading: false } : s
      ));
    }
  };

  // Select a player for an extra slot
  const handleExtraSlotSelect = (slotId: string, player: { id: string; name: string }) => {
    setExtraSlots(prev => prev.map(s => 
      s.id === slotId ? { ...s, userId: player.id, name: player.name, searchQuery: '', searchResults: [] } : s
    ));
  };

  // Clear an extra slot selection
  const handleExtraSlotClear = (slotId: string) => {
    setExtraSlots(prev => prev.map(s => 
      s.id === slotId ? { ...s, userId: null, name: '', searchQuery: '', searchResults: [], position: null, knockouts: 0, pointsEarned: null } : s
    ));
  };

  // Update extra slot position
  const updateExtraPosition = (slotId: string, position: number | null) => {
    setExtraSlots(prev => prev.map(s => 
      s.id === slotId ? { ...s, position } : s
    ));
  };

  // Update extra slot knockouts
  const updateExtraKnockouts = (slotId: string, knockouts: number) => {
    setExtraSlots(prev => prev.map(s => 
      s.id === slotId ? { ...s, knockouts: Math.max(0, knockouts) } : s
    ));
  };

  const updateExtraPointsEarned = (slotId: string, pointsEarned: number | null) => {
    setExtraSlots(prev => prev.map(s =>
      s.id === slotId ? { ...s, pointsEarned: pointsEarned === null ? null : Math.max(0, pointsEarned) } : s
    ));
  };

  const handleSaveResults = async (finalize: boolean = false) => {
    const attendedPlayers = playerResults.filter(p => p.attended);
    // Include extra slots that have a user assigned
    const filledExtraSlots = extraSlots.filter(s => s.userId !== null);
    
    // Combine all players (registered attended + extra slots)
    const allPlayers = [
      ...attendedPlayers.map(p => ({ userId: p.userId, position: p.position, knockouts: p.knockouts, pointsEarned: p.pointsEarned })),
      ...filledExtraSlots.map(s => ({ userId: s.userId!, position: s.position, knockouts: s.knockouts, pointsEarned: s.pointsEarned })),
    ];
    
    // Validate positions for all players
    const playersWithPositions = allPlayers.filter(p => p.position !== null);

    // Always check for duplicate positions (both save and finalize)
    const positions = playersWithPositions.map(p => p.position);
    const uniquePositions = new Set(positions);
    if (positions.length !== uniquePositions.size) {
      setResultMessage({ type: 'error', text: 'Each player must have a unique position — no duplicate places allowed' });
      return;
    }

    if (finalize) {
      // For finalization, positions 1, 2, and 3 must be assigned
      if (!positions.includes(1) || !positions.includes(2) || !positions.includes(3)) {
        setResultMessage({ type: 'error', text: 'Places 1st, 2nd, and 3rd must be assigned to finalize results' });
        return;
      }
    }

    setSavingResults(true);
    setResultMessage(null);

    try {
      // Only submit players with positions
      const resultsToSubmit = playersWithPositions.map(p => ({
        userId: p.userId,
        position: p.position!,
        knockouts: p.knockouts,
        ...(p.pointsEarned !== null ? { pointsEarned: p.pointsEarned } : {}),
      }));

      if (resultsToSubmit.length > 0) {
        await eventsAPI.enterResults(eventId, resultsToSubmit, finalize);
      }

      if (finalize) {
        setResultMessage({ type: 'success', text: 'Results finalized! Standings have been updated.' });
      } else if (isFinalized) {
        setResultMessage({ type: 'success', text: 'Corrections saved. Standings have been updated.' });
      } else {
        setResultMessage({ type: 'success', text: 'Results saved. You can continue editing.' });
      }
      
      loadEvent();
    } catch (err: any) {
      setResultMessage({ type: 'error', text: err.message || 'Failed to save results' });
    } finally {
      setSavingResults(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      SCHEDULED: { bg: 'bg-blue-500', text: 'Scheduled' },
      REGISTRATION_OPEN: { bg: 'bg-blue-500', text: 'Registration Open' },
      IN_PROGRESS: { bg: 'bg-yellow-500', text: 'In Progress' },
      COMPLETED: { bg: 'bg-gray-500', text: 'Completed' },
      CANCELLED: { bg: 'bg-red-500', text: 'Cancelled' },
    };
    return badges[status] || { bg: 'bg-gray-500', text: status };
  };

  if (loading) {
    return (
      <div className="min-h-screen page-gradient-event-detail flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-blue-100 mt-4">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen page-gradient-event-detail flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-xl">{error || 'Event not found'}</p>
          <Link href="/events" className="text-blue-300 mt-4 inline-block hover:underline">
            ← Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusBadge(event.status);
  // Count registered (non-waitlisted) players
  const registeredCount = event.signups.filter(s => s.status !== 'WAITLISTED' && s.status !== 'CANCELLED').length;
  const waitlistedCount = event.signups.filter(s => s.status === 'WAITLISTED').length;
  const isFull = registeredCount >= event.maxPlayers;
  const canSignup = (event.status === 'SCHEDULED' || event.status === 'REGISTRATION_OPEN');
  const canEnterResults = canManageEvent && (event.status === 'IN_PROGRESS' || event.status === 'REGISTRATION_OPEN' || event.status === 'SCHEDULED');
  const isFinalized = event.status === 'COMPLETED';

  // Registration close check: non-admin users can't register/unregister after close time
  const regCloseMinutes = event.registrationCloseMinutes ?? 30;
  const regCloseTime = new Date(new Date(event.dateTime).getTime() - regCloseMinutes * 60 * 1000);
  const isRegistrationClosed = new Date() >= regCloseTime;
  const isAdmin = user?.role === 'ADMIN';
  const playerRegBlocked = isRegistrationClosed && !isAdmin;

  return (
    <div className="min-h-screen page-gradient-event-detail ">
      <MobileNav currentPage="events" />

      <main className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        {/* Back Link */}
        <Link href="/events" className="text-blue-300 hover:text-blue-200 mb-4 md:mb-6 inline-block text-sm md:text-base">
          ← Back to Events
        </Link>

        {/* Event Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
          <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
            <div>
              <span className={`${statusInfo.bg} text-white px-3 py-1 rounded-full text-sm font-medium`}>
                {statusInfo.text}
              </span>
              <h1 className="text-3xl font-bold text-white mt-3">{event.name}</h1>
              <p className="text-blue-100 mt-1">{event.season.name}</p>
            </div>
            {event.buyInSats != null && event.buyInSats > 0 && (
              <div className="text-right">
                <p className="text-blue-200 text-sm">Buy-in</p>
                <p className="text-3xl font-bold text-yellow-400">{event.buyInSats.toLocaleString()} sats</p>
                {event.prepayDiscountSats != null && event.prepayDiscountSats > 0 && (
                  <p className="text-yellow-300/80 text-xs mt-1">
                    Save {event.prepayDiscountSats.toLocaleString()} sats when paid {event.prepayDiscountHours ?? 3}h+ early
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-blue-100">
                <span className="text-2xl">📅</span>
                <div>
                  <p className="font-medium text-white">Date & Time</p>
                  <p>{formatDate(event.dateTime)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-blue-100">
                {event.venue.imageUrl ? (
                  <img
                    src={event.venue.imageUrl}
                    alt={event.venue.name}
                    className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="text-2xl">📍</span>
                )}
                <div>
                  <p className="font-medium text-white">{event.venue.name}</p>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300/80 hover:text-blue-200 underline underline-offset-2"
                  >
                    {event.venue.address}
                  </a>
                </div>
              </div>
              {event.director && (
                <div className="flex items-center gap-3 text-blue-100">
                  <span className="text-2xl">👤</span>
                  <div>
                    <p className="font-medium text-white">Tournament Director</p>
                    <p>{event.director.name}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-blue-100">
                <span className="text-2xl">👥</span>
                <div>
                  <p className="font-medium text-white">Players</p>
                  <p>
                    {registeredCount} / {event.maxPlayers} registered
                    {waitlistedCount > 0 && (
                      <span className="text-yellow-400 ml-2">({waitlistedCount} on waitlist)</span>
                    )}
                  </p>
                  {isFull && <p className="text-yellow-400 text-sm">Event is full - join waitlist</p>}
                </div>
              </div>
              
              {/* User's waitlist status */}
              {userSignupStatus === 'WAITLISTED' && waitlistPosition && (
                <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3">
                  <p className="text-yellow-400 font-medium">
                    ⏳ You are #{waitlistPosition} on the waitlist
                  </p>
                  <p className="text-yellow-300/70 text-sm">
                    You'll be notified if a spot opens up
                  </p>
                </div>
              )}
              
              {/* Registration Closed Banner */}
              {canSignup && playerRegBlocked && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3">
                  <p className="text-red-400 font-medium">
                    🔒 Registration closed
                  </p>
                  <p className="text-red-300/70 text-sm">
                    Registration closed {regCloseMinutes} minutes before the event
                  </p>
                </div>
              )}

              {/* Signup Button */}
              {canSignup && !playerRegBlocked && (
                <div className="pt-4">
                  {isSignedUp ? (
                    <div className="space-y-2">
                      {userSignupStatus === 'WAITLISTED' ? (
                        <button
                          onClick={handleCancelSignup}
                          className="w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 transition"
                        >
                          Leave Waitlist
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={handleCancelSignup}
                            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition"
                          >
                            Cancel Registration
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleSignup}
                      className={`w-full py-3 rounded-lg font-semibold transition ${
                        isFull 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {!isAuthenticated 
                        ? 'Sign In to Register' 
                        : isFull 
                          ? 'Join Waitlist' 
                          : 'Register for Event'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {event.description && (
            <div className="mt-6 pt-6 border-t border-blue-600/30">
              <h3 className="text-white font-medium mb-2">About this Event</h3>
              <p className="text-blue-100">{event.description}</p>
            </div>
          )}
        </div>

        {/* Last Longer Pool disabled: backend now always reports disabled. */}
        {lastLongerPool?.enabled && (
          <div id="last-longer-pool" className="bg-purple-500/10 backdrop-blur-sm rounded-xl border border-purple-500/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-purple-300 mb-4">⚡ Last Longer Pool</h2>
            
            {/* Pool Info */}
            <div className="grid grid-cols-3 gap-4 text-center mb-4">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-purple-200 text-xs">Seed</p>
                <p className="text-white font-bold">{lastLongerPool.seedSats.toLocaleString()} sats</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-purple-200 text-xs">Entry</p>
                <p className="text-white font-bold">{lastLongerPool.entrySats.toLocaleString()} sats</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-purple-200 text-xs">Total Pot</p>
                <p className="text-yellow-400 font-bold">{lastLongerPool.totalPot.toLocaleString()} sats</p>
              </div>
            </div>

            {/* Winner Display */}
            {lastLongerPool.winnerName && (
              <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-4 text-center">
                <p className="text-yellow-400 text-lg font-bold">🏆 {lastLongerPool.winnerName} wins!</p>
                <p className="text-yellow-300/70 text-sm">{lastLongerPool.totalPot.toLocaleString()} sats credited to their balance</p>
              </div>
            )}

            {/* Player Entry Section */}
            {isAuthenticated && isSignedUp && userSignupStatus !== 'WAITLISTED' && !lastLongerPool.winnerId && (
              <div className="mb-4">
                {lastLongerPool.userEntry?.paidAt ? (
                  <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3 text-center">
                    <p className="text-green-400 font-medium">✅ You&apos;re in the Last Longer pool!</p>
                  </div>
                ) : lastLongerInvoice ? (
                  <div className="bg-white/5 border border-purple-500/30 rounded-lg p-4">
                    <p className="text-purple-200 text-sm mb-3 text-center">
                      Pay {lastLongerInvoice.amountSats.toLocaleString()} sats to enter the pool
                    </p>
                    <div className="bg-white rounded-lg p-4 mx-auto max-w-xs">
                      <div className="text-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(lastLongerInvoice.paymentRequest)}`}
                          alt="Lightning Invoice QR Code"
                          className="w-48 h-48 mx-auto mb-3"
                        />
                        <p className="text-gray-800 text-xs font-mono break-all select-all mb-2">
                          {lastLongerInvoice.paymentRequest.slice(0, 60)}...
                        </p>
                        <button
                          onClick={() => navigator.clipboard.writeText(lastLongerInvoice.paymentRequest)}
                          className="text-purple-600 text-sm hover:text-purple-800 font-medium"
                        >
                          📋 Copy Invoice
                        </button>
                      </div>
                    </div>
                    {paymentPolling && (
                      <div className="flex items-center justify-center gap-2 mt-3">
                        <div className="animate-spin h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full"></div>
                        <p className="text-purple-300 text-sm">Waiting for payment...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleEnterLastLonger}
                    disabled={lastLongerLoading}
                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white py-3 rounded-lg font-semibold transition"
                  >
                    {lastLongerLoading ? 'Creating invoice...' : `⚡ Enter Last Longer Pool (${lastLongerPool.entrySats.toLocaleString()} sats)`}
                  </button>
                )}
              </div>
            )}

            {/* Not signed up prompt */}
            {isAuthenticated && !isSignedUp && !lastLongerPool.winnerId && (
              <div className="mb-4 bg-white/5 border border-purple-500/20 rounded-lg p-3 text-center">
                <p className="text-purple-300/70 text-sm">Register for this event to enter the Last Longer pool</p>
              </div>
            )}

            {/* Not logged in prompt */}
            {!isAuthenticated && !lastLongerPool.winnerId && (
              <div className="mb-4 bg-white/5 border border-purple-500/20 rounded-lg p-3 text-center">
                <p className="text-purple-300/70 text-sm">
                  <Link href="/login" className="text-purple-300 hover:text-purple-200 underline">Sign in</Link> and register to enter the Last Longer pool
                </p>
              </div>
            )}

            {/* Message */}
            {lastLongerMessage && (
              <div className={`mb-4 p-3 rounded-lg ${
                lastLongerMessage.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-400'
              }`}>
                {lastLongerMessage.text}
              </div>
            )}

            {/* Entries List */}
            {lastLongerPool.entries.length > 0 && (
              <div>
                <h3 className="text-purple-200 font-medium text-sm mb-2">
                  Pool Entries ({lastLongerPool.entryCount})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {lastLongerPool.entries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                      <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {entry.userName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm truncate">{entry.userName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin: Select Winner */}
            {canManageEvent && lastLongerPool.entries.length > 0 && !lastLongerPool.winnerId && (
              <div className="mt-4 pt-4 border-t border-purple-500/30">
                <h3 className="text-orange-300 font-medium text-sm mb-2">🎯 Select Winner (Admin)</h3>
                <div className="flex gap-2">
                  <select
                    value={selectedWinnerId}
                    onChange={(e) => setSelectedWinnerId(e.target.value)}
                    className="flex-1 p-3 bg-white/10 border border-purple-500/50 rounded-lg text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="" className="bg-gray-900">Select winner...</option>
                    {lastLongerPool.entries.map(entry => (
                      <option key={entry.userId} value={entry.userId} className="bg-gray-900">
                        {entry.userName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSelectWinner}
                    disabled={!selectedWinnerId || selectingWinner}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:opacity-50 text-white rounded-lg font-medium transition"
                  >
                    {selectingWinner ? '...' : '🏆 Award'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tournament Director Management Panel */}
        {canManageEvent && (
          <div className="bg-orange-500/10 backdrop-blur-sm rounded-xl border border-orange-500/30 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-orange-300">🎯 Tournament Director Panel {isFinalized && <span className="text-sm font-normal text-orange-200/70">(editing completed event)</span>}</h2>
              <button
                onClick={() => setShowManagement(!showManagement)}
                className="text-orange-400 hover:text-orange-300"
              >
                {showManagement ? 'Hide' : 'Show'} Management
              </button>
            </div>

            {showManagement && (
              <div className="space-y-6">
                {/* Registrants + payment status */}
                <RegistrantsPanel
                  eventId={eventId}
                  buyInSats={event.buyInSats ?? 0}
                  onChange={loadEvent}
                />

                {/* Status Controls */}
                <div>
                  <h3 className="text-white font-medium mb-2">Event Status</h3>
                  <div className="flex flex-wrap gap-2">
                    {['SCHEDULED', 'REGISTRATION_OPEN', 'IN_PROGRESS'].map(status => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        disabled={event.status === status}
                        className={`px-4 py-2 rounded-lg font-medium transition ${
                          event.status === status 
                            ? 'bg-blue-600 text-white cursor-default' 
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Add Player */}
                <div>
                  <h3 className="text-white font-medium mb-2">➕ Quick Add Player</h3>
                  <p className="text-orange-200/70 text-sm mb-3">
                    Add walk-ins who didn&apos;t register. Search existing users or create a guest.
                  </p>
                  <div className="flex gap-2 mb-3">
                    <button
                      onClick={() => setQuickAddMode('search')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        quickAddMode === 'search' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      🔍 Search User
                    </button>
                    <button
                      onClick={() => setQuickAddMode('guest')}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        quickAddMode === 'guest' ? 'bg-orange-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      👤 New Guest
                    </button>
                  </div>

                  {quickAddMode === 'search' ? (
                    <div className="relative">
                      <input
                        type="text"
                        value={quickAddSearch}
                        onChange={(e) => handleQuickAddSearch(e.target.value)}
                        placeholder="Type a name to search..."
                        className="w-full p-3 bg-white/10 border border-orange-500/50 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400"
                      />
                      {quickAddLoading && (
                        <div className="absolute right-3 top-3.5">
                          <div className="animate-spin h-5 w-5 border-2 border-orange-400 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                      {quickAddResults.length > 0 && (
                        <div className="mt-2 bg-black/60 border border-orange-500/30 rounded-lg overflow-hidden">
                          {quickAddResults.map(u => (
                            <button
                              key={u.id}
                              onClick={() => handleQuickAddExisting(u.id)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-orange-500/20 transition text-left"
                            >
                              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-white font-medium text-sm">{u.name}</p>
                                <p className="text-white/50 text-xs">
                                  {u.isGuest ? 'Guest' : u.email || 'No email'}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {quickAddSearch.length >= 2 && !quickAddLoading && quickAddResults.length === 0 && (
                        <p className="text-orange-200/50 text-sm mt-2">
                          No users found. Try &quot;New Guest&quot; to add them by name.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickAddGuest()}
                        placeholder="Guest name (min 2 chars)..."
                        className="flex-1 p-3 bg-white/10 border border-orange-500/50 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400"
                      />
                      <button
                        onClick={handleQuickAddGuest}
                        disabled={guestName.trim().length < 2}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:opacity-50 text-white rounded-lg font-medium transition"
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                {/* Total Entrants Override */}
                <div>
                  <h3 className="text-white font-medium mb-2">📊 Total Entrants</h3>
                  <p className="text-orange-200/70 text-sm mb-3">
                    Override the total player count for points calculation (e.g., if some players aren&apos;t in the system).
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={totalEntrantsInput}
                      onChange={(e) => setTotalEntrantsInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSetTotalEntrants()}
                      placeholder={`Current: ${registeredCount} registered`}
                      className="flex-1 p-3 bg-white/10 border border-orange-500/50 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400"
                    />
                    <button
                      onClick={handleSetTotalEntrants}
                      disabled={savingTotalEntrants}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:opacity-50 text-white rounded-lg font-medium transition"
                    >
                      {savingTotalEntrants ? '...' : 'Set'}
                    </button>
                    {totalEntrantsInput && (
                      <button
                        onClick={() => { setTotalEntrantsInput(''); handleSetTotalEntrants(); }}
                        className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white/70 rounded-lg text-sm transition"
                        title="Clear override"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Points Preview */}
                {pointsPreview && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h3 className="text-blue-300 font-medium mb-2">💰 Points Pool Preview</h3>
                    <p className="text-blue-100/70 text-sm mb-3">
                      Based on {pointsPreview.playerCount} checked-in players
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-yellow-400 text-2xl font-bold">🥇 {pointsPreview.first}</p>
                        <p className="text-blue-100/60 text-xs">1st Place</p>
                      </div>
                      <div>
                        <p className="text-gray-300 text-2xl font-bold">🥈 {pointsPreview.second}</p>
                        <p className="text-blue-100/60 text-xs">2nd Place</p>
                      </div>
                      <div>
                        <p className="text-orange-400 text-2xl font-bold">🥉 {pointsPreview.third}</p>
                        <p className="text-blue-100/60 text-xs">3rd Place</p>
                      </div>
                    </div>
                    <p className="text-blue-100/50 text-xs mt-3 text-center">
                      Total Pool: {pointsPreview.totalPool} pts (60%/30%/10% split, rounded up)
                    </p>
                  </div>
                )}

                {/* Results Entry */}
                <div>
                  <h3 className="text-white font-medium mb-3">📋 Attendance & Results</h3>
                  <p className="text-orange-200/70 text-sm mb-4">
                    Mark who attended, then enter their finishing positions. Rows stay in signup order while you type. Leave Points blank to use the automatic top-3 award, or enter a value to override/correct a completed event.
                  </p>

                  {playerResults.length === 0 ? (
                    <p className="text-orange-200/60">No registered players yet</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Header - Desktop */}
                      <div className="hidden md:grid grid-cols-12 gap-2 text-orange-200/70 text-sm font-medium px-3 py-2">
                        <div className="col-span-1">Came</div>
                        <div className="col-span-4">Player</div>
                        <div className="col-span-2">Position</div>
                        <div className="col-span-2">Points</div>
                        <div className="col-span-3">Knockouts</div>
                      </div>

                      {playerResults.map((player) => (
                        <div 
                          key={player.userId}
                          className={`p-3 rounded-lg min-h-[72px] ${
                            player.attended ? 'bg-blue-500/20' : 'bg-white/5'
                          }`}
                        >
                          {/* Mobile Layout */}
                          <div className="md:hidden space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={player.attended}
                                  onChange={() => toggleAttendance(player.userId)}
                                  className="w-5 h-5 rounded border-blue-600 bg-white/10 text-blue-500 focus:ring-blue-500"
                                />
                                <span className={`font-medium ${player.attended ? 'text-white' : 'text-gray-400'}`}>
                                  {player.name}
                                </span>
                              </div>
                            </div>
                            <div className={`flex items-center gap-4 pl-8 ${!player.attended ? 'opacity-30 pointer-events-none' : ''}`}>
                              <div className="flex-1">
                                <label className="text-orange-200/70 text-xs block mb-1">Position</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={playerResults.filter(p => p.attended).length}
                                  value={player.position || ''}
                                  onChange={(e) => updatePosition(player.userId, e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="#"
                                  disabled={!player.attended}
                                  className="w-full p-2 bg-white/10 border border-blue-600/50 rounded text-white text-center disabled:opacity-50"
                                />
                              </div>
                              <div className="flex-1">
                                <label className="text-orange-200/70 text-xs block mb-1">Points</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={player.pointsEarned ?? ''}
                                  onChange={(e) => updatePointsEarned(player.userId, e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="auto"
                                  disabled={!player.attended}
                                  className="w-full p-2 bg-white/10 border border-blue-600/50 rounded text-white text-center disabled:opacity-50"
                                />
                              </div>
                              <div>
                                <label className="text-orange-200/70 text-xs block mb-1">KOs</label>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => updateKnockouts(player.userId, player.knockouts - 1)}
                                    disabled={!player.attended}
                                    className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20 disabled:opacity-50"
                                  >
                                    -
                                  </button>
                                  <span className="w-8 text-center text-white">{player.knockouts}</span>
                                  <button
                                    onClick={() => updateKnockouts(player.userId, player.knockouts + 1)}
                                    disabled={!player.attended}
                                    className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20 disabled:opacity-50"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Desktop Layout */}
                          <div className="hidden md:grid grid-cols-12 gap-2 items-center min-h-[40px]">
                            <div className="col-span-1">
                              <input
                                type="checkbox"
                                checked={player.attended}
                                onChange={() => toggleAttendance(player.userId)}
                                className="w-5 h-5 rounded border-blue-600 bg-white/10 text-blue-500 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-4">
                              <span className={`font-medium ${player.attended ? 'text-white' : 'text-gray-400'}`}>
                                {player.name}
                              </span>
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                min="1"
                                max={playerResults.filter(p => p.attended).length}
                                value={player.position || ''}
                                onChange={(e) => updatePosition(player.userId, e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="#"
                                disabled={!player.attended}
                                className={`w-full p-2 bg-white/10 border border-blue-600/50 rounded text-white text-center disabled:opacity-30 ${!player.attended ? 'invisible' : ''}`}
                              />
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                min="0"
                                value={player.pointsEarned ?? ''}
                                onChange={(e) => updatePointsEarned(player.userId, e.target.value ? parseInt(e.target.value) : null)}
                                placeholder="auto"
                                disabled={!player.attended}
                                className={`w-full p-2 bg-white/10 border border-blue-600/50 rounded text-white text-center disabled:opacity-30 ${!player.attended ? 'invisible' : ''}`}
                              />
                            </div>
                            <div className="col-span-3">
                              <div className={`flex items-center gap-1 ${!player.attended ? 'invisible' : ''}`}>
                                <button
                                  onClick={() => updateKnockouts(player.userId, player.knockouts - 1)}
                                  disabled={!player.attended}
                                  className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20 disabled:opacity-30"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center text-white">{player.knockouts}</span>
                                <button
                                  onClick={() => updateKnockouts(player.userId, player.knockouts + 1)}
                                  disabled={!player.attended}
                                  className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20 disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extra Player Slots (from totalEntrants override) */}
                  {extraSlots.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-orange-300 font-medium mb-2 text-sm">
                        ➕ Additional Players ({extraSlots.filter(s => s.userId !== null).length} assigned / {extraSlots.length} slots)
                      </h4>
                      <div className="space-y-2">
                        {extraSlots.map((slot) => (
                          <div key={slot.id} className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                            {slot.userId ? (
                              <div className="md:grid grid-cols-12 gap-2 items-center">
                                <div className="col-span-1">
                                  <span className="text-blue-300">✓</span>
                                </div>
                                <div className="col-span-4 flex items-center gap-2">
                                  <span className="text-white font-medium">{slot.name}</span>
                                  <button onClick={() => handleExtraSlotClear(slot.id)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                                </div>
                                <div className="col-span-2">
                                  <input
                                    type="number" min="1"
                                    value={slot.position || ''}
                                    onChange={(e) => updateExtraPosition(slot.id, e.target.value ? parseInt(e.target.value) : null)}
                                    placeholder="#"
                                    className="w-full p-2 bg-white/10 border border-orange-500/50 rounded text-white text-center"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <input
                                    type="number" min="0"
                                    value={slot.pointsEarned ?? ''}
                                    onChange={(e) => updateExtraPointsEarned(slot.id, e.target.value ? parseInt(e.target.value) : null)}
                                    placeholder="auto"
                                    className="w-full p-2 bg-white/10 border border-orange-500/50 rounded text-white text-center"
                                  />
                                </div>
                                <div className="col-span-3">
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => updateExtraKnockouts(slot.id, slot.knockouts - 1)} className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20">-</button>
                                    <span className="w-8 text-center text-white">{slot.knockouts}</span>
                                    <button onClick={() => updateExtraKnockouts(slot.id, slot.knockouts + 1)} className="w-8 h-8 bg-white/10 rounded text-white hover:bg-white/20">+</button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="relative">
                                <input
                                  type="text"
                                  value={slot.searchQuery}
                                  onChange={(e) => handleExtraSlotSearch(slot.id, e.target.value)}
                                  placeholder="Search player by name..."
                                  className="w-full p-2 bg-white/10 border border-orange-500/50 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-orange-400"
                                />
                                {slot.searchLoading && (
                                  <div className="absolute right-3 top-2.5">
                                    <div className="animate-spin h-4 w-4 border-2 border-orange-400 border-t-transparent rounded-full"></div>
                                  </div>
                                )}
                                {slot.searchResults.length > 0 && (
                                  <div className="absolute z-10 mt-1 w-full bg-black/90 border border-orange-500/30 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                                    {slot.searchResults.map(u => (
                                      <button
                                        key={u.id}
                                        onClick={() => handleExtraSlotSelect(slot.id, { id: u.id, name: u.name })}
                                        className="w-full flex items-center gap-2 p-2 hover:bg-orange-500/20 transition text-left"
                                      >
                                        <div className="w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                          {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-white text-sm">{u.name}</span>
                                        <span className="text-white/40 text-xs">{u.isGuest ? 'Guest' : u.email || ''}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resultMessage && (
                    <div className={`mt-4 p-3 rounded-lg ${
                      resultMessage.type === 'success' ? 'bg-blue-500/20 text-blue-300' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {resultMessage.text}
                    </div>
                  )}

                  {playerResults.length > 0 && (
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => handleSaveResults(false)}
                        disabled={savingResults}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg font-medium transition"
                      >
                        {savingResults ? 'Saving...' : (isFinalized ? '💾 Save Corrections' : '💾 Save Draft')}
                      </button>
                      {!isFinalized && (
                        <button
                          onClick={() => handleSaveResults(true)}
                          disabled={savingResults}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-2 rounded-lg font-medium transition"
                        >
                          {savingResults ? 'Finalizing...' : '✅ Finalize Results'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Results (if completed) - only show players who earned points */}
        {event.results.filter(r => r.pointsEarned > 0).length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">🏆 Results {isFinalized && <span className="text-blue-300 text-sm font-normal">(Final)</span>}</h2>
            <div className="space-y-2">
              {event.results.filter(r => r.pointsEarned > 0).map((result, index) => (
                <div
                  key={result.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 ? 'bg-yellow-500/20 border border-yellow-500/50' :
                    index === 1 ? 'bg-gray-400/20 border border-gray-400/50' :
                    index === 2 ? 'bg-orange-600/20 border border-orange-600/50' :
                    'bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-white w-8">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${result.position}`}
                    </span>
                    {(result.user.profile?.profileImage || result.user.avatar) ? (
                      <img src={result.user.profile?.profileImage || result.user.avatar} alt={result.user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {result.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <Link href={`/players/${result.user.id}`} className="text-white font-medium hover:text-blue-300 transition">
                      {result.user.name}
                    </Link>
                  </div>
                  <div className="text-right">
                    <p className="text-blue-300 font-bold">{result.pointsEarned} pts</p>
                    {result.knockouts > 0 && (
                      <p className="text-xs text-blue-200">{result.knockouts} KOs</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Players section - show registered players (or attendees for completed events) */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4">
            {isFinalized ? (
              <>👥 Players Who Attended ({event.signups.filter(s => s.status !== 'WAITLISTED' && s.status !== 'CANCELLED').length})</>
            ) : (
              <>
                👥 Registered Players ({registeredCount})
                {waitlistedCount > 0 && (
                  <span className="text-yellow-400 text-sm font-normal ml-2">+ {waitlistedCount} waitlisted</span>
                )}
              </>
            )}
          </h2>
          {event.signups.length === 0 ? (
            <p className="text-blue-200/60">No players registered yet</p>
          ) : (
            <div className="space-y-4">
              {/* Registered players */}
              <div className={canManageEvent && !isFinalized ? 'space-y-2' : 'grid grid-cols-2 md:grid-cols-3 gap-3'}>
                {event.signups
                  .filter(s => s.status !== 'WAITLISTED' && s.status !== 'CANCELLED')
                  .map((signup) => (
                    <div
                      key={signup.id}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        signup.status === 'CHECKED_IN' ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/5'
                      }`}
                    >
                      {(signup.user.profile?.profileImage || signup.user.avatar) ? (
                        <img src={signup.user.profile?.profileImage || signup.user.avatar} alt={signup.user.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                          {signup.user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <Link href={`/players/${signup.user.id}`} className="text-white text-sm truncate flex-1 hover:text-blue-300 transition">
                        {signup.user.name}
                      </Link>
                      {signup.status === 'CHECKED_IN' && (
                        <span className="text-blue-300 text-xs flex-shrink-0">✓</span>
                      )}
                      {/* Admin/TD controls */}
                      {canManageEvent && !isFinalized && (
                        <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                          {signup.status !== 'CHECKED_IN' && (
                            <button
                              onClick={async () => {
                                try {
                                  await eventsAPI.checkIn(eventId, signup.user.id);
                                  setResultMessage({ type: 'success', text: `${signup.user.name} checked in` });
                                  loadEvent();
                                } catch (err: any) {
                                  setResultMessage({ type: 'error', text: err.message || 'Failed to check in' });
                                }
                              }}
                              className="px-2 py-1 bg-blue-600/50 hover:bg-blue-600 text-blue-100 hover:text-white rounded text-xs font-medium transition"
                              title="Check in"
                            >
                              ✓ Check In
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              if (!confirm(`Remove ${signup.user.name} from this event?`)) return;
                              try {
                                await eventsAPI.removePlayer(eventId, signup.user.id);
                                setResultMessage({ type: 'success', text: `${signup.user.name} removed` });
                                loadEvent();
                              } catch (err: any) {
                                setResultMessage({ type: 'error', text: err.message || 'Failed to remove player' });
                              }
                            }}
                            className="px-2 py-1 bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white rounded text-xs font-medium transition"
                            title="Remove player"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>
              
              {/* Waitlisted players */}
              {waitlistedCount > 0 && (
                <div>
                  <h3 className="text-yellow-400 font-medium mb-2 text-sm">⏳ Waitlist</h3>
                  <div className={canManageEvent && !isFinalized ? 'space-y-2' : 'grid grid-cols-2 md:grid-cols-3 gap-3'}>
                    {event.signups
                      .filter(s => s.status === 'WAITLISTED')
                      .map((signup, index) => (
                        <div
                          key={signup.id}
                          className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                        >
                          <div className="w-6 h-6 bg-yellow-600/50 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <span className="text-yellow-200 text-sm truncate flex-1">{signup.user.name}</span>
                          {/* Admin/TD controls for waitlisted */}
                          {canManageEvent && !isFinalized && (
                            <div className="flex items-center gap-1 flex-shrink-0 ml-auto">
                              <button
                                onClick={async () => {
                                  if (!confirm(`Remove ${signup.user.name} from the waitlist?`)) return;
                                  try {
                                    await eventsAPI.removePlayer(eventId, signup.user.id);
                                    setResultMessage({ type: 'success', text: `${signup.user.name} removed from waitlist` });
                                    loadEvent();
                                  } catch (err: any) {
                                    setResultMessage({ type: 'error', text: err.message || 'Failed to remove player' });
                                  }
                                }}
                                className="px-2 py-1 bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white rounded text-xs font-medium transition"
                                title="Remove from waitlist"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Automatic Event Side Bet */}
        {eventSideBet && (
          <div className="mt-8 bg-white/10 backdrop-blur rounded-xl p-5 border border-yellow-500/30">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">🎲 Event Side Bet</h2>
                <p className="text-yellow-200/80 text-sm mt-1">
                  Top finishers in this event split the side pot.
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-yellow-300 font-bold text-2xl">⚡ {eventSideBet.totalPot.toLocaleString()}</p>
                <p className="text-white/50 text-xs">current pot</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-white font-bold">{eventSideBet.entrySats.toLocaleString()}</p>
                <p className="text-white/50 text-xs">sats entry</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-white font-bold">{eventSideBet.entryCount}</p>
                <p className="text-white/50 text-xs">entries</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center sm:col-span-2">
                <p className="text-white/80 text-xs leading-relaxed">
                  7+ players: 3rd gets one entry back, then 2nd gets 30% and 1st gets 70% of the remainder. 3–6 players: 30%/70%. 1–2 players: winner takes all.
                </p>
              </div>
            </div>

            {sideBetMessage && (
              <div className={`rounded-lg p-3 mb-4 text-sm ${sideBetMessage.type === 'success' ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 'bg-red-500/20 border border-red-500/30 text-red-300'}`}>
                {sideBetMessage.text}
              </div>
            )}

            {isAuthenticated && user && eventSideBet.entries?.some(e => e.userId === user.id) && (
              <p className="text-green-300 text-center font-medium mb-3">
                ✅ You have {eventSideBet.entries.find(e => e.userId === user.id)?.entryCount || 0} {(eventSideBet.entries.find(e => e.userId === user.id)?.entryCount || 0) === 1 ? 'entry' : 'entries'} in this side bet
              </p>
            )}

            {!sideBetInvoice ? (
              <button
                onClick={handleEnterEventSideBet}
                disabled={sideBetLoading || eventSideBet.status !== 'OPEN'}
                className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 disabled:text-white text-black font-bold py-3 rounded-lg transition"
              >
                {sideBetLoading ? '⏳ Entering…' : `Enter Side Bet (${eventSideBet.entrySats.toLocaleString()} sats)`}
              </button>
            ) : (
              <div className="text-center bg-black/20 rounded-xl p-4">
                <h3 className="text-white font-bold mb-3">⚡ Pay {sideBetInvoice.amountSats.toLocaleString()} sats to enter</h3>
                <div className="bg-white p-4 rounded-lg inline-block mb-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(sideBetInvoice.paymentRequest)}`}
                    alt="Lightning side bet invoice QR"
                    className="w-52 h-52"
                  />
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(sideBetInvoice.paymentRequest)}
                    className="text-blue-300 hover:text-blue-200 text-xs underline"
                  >
                    Copy invoice
                  </button>
                  <button
                    onClick={() => setSideBetInvoice(null)}
                    className="block mx-auto text-gray-400 hover:text-white text-sm"
                  >
                    ✕ Close
                  </button>
                </div>
                <p className="text-white/50 text-xs mt-3">Waiting for payment…</p>
              </div>
            )}

            <Link href={`/bets/${eventSideBet.id}`} className="block text-center text-blue-300 hover:text-blue-200 text-xs mt-3">
              View full side bet details →
            </Link>
          </div>
        )}
      </main>

      {/* Buy-in Payment Modal
          Two paths:
          1) Pay Now: server mints a Lightning invoice; we render a QR + poll for settlement.
          2) Pay on Arrival: skip the invoice and register; the TD will mark them paid at the venue. */}
      {payModalOpen && event && event.buyInSats && event.buyInSats > 0 && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-gray-900 border border-blue-600/40 rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-white">Buy-in Required</h2>
              <button onClick={() => setPayModalOpen(false)} className="text-white/60 hover:text-white text-2xl leading-none">×</button>
            </div>

            {paymentConfirmed ? (
              <div className="text-center py-6">
                <p className="text-5xl mb-3">✅</p>
                <p className="text-green-400 font-bold text-xl mb-1">Payment received!</p>
                <p className="text-white/70 text-sm">You're registered for the event.</p>
                <button
                  onClick={() => setPayModalOpen(false)}
                  className="mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                >
                  Done
                </button>
              </div>
            ) : payInvoice ? (
              <>
                <p className="text-center text-white mb-1">
                  Scan with any Lightning wallet to pay
                </p>
                <p className="text-center text-yellow-400 font-bold text-2xl mb-4">
                  {payInvoice.amountSats.toLocaleString()} sats
                </p>
                {payInvoice.discountApplied && (
                  <p className="text-center text-green-400 text-sm mb-3">
                    🎉 Prepay discount applied! Saved {(payInvoice.fullPriceSats - payInvoice.amountSats).toLocaleString()} sats.
                  </p>
                )}
                <div className="bg-white rounded-lg p-4 mx-auto max-w-xs">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payInvoice.paymentRequest)}`}
                    alt="Lightning invoice QR code"
                    className="w-full h-auto"
                  />
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(payInvoice.paymentRequest).catch(() => {});
                  }}
                  className="mt-3 w-full text-blue-300 hover:text-blue-200 text-xs underline"
                >
                  Copy invoice
                </button>
                <p className="text-center text-white/60 text-xs mt-3">
                  {paymentChecking ? 'Checking for payment…' : 'Waiting for payment…'}
                </p>
                <button
                  onClick={() => setPayModalOpen(false)}
                  className="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm"
                >
                  Close (your registration is held until paid)
                </button>
              </>
            ) : (
              <>
                <div className="bg-white/5 rounded-lg p-4 mb-4">
                  <p className="text-white/70 text-sm">Buy-in</p>
                  <p className="text-yellow-400 font-bold text-2xl">{event.buyInSats.toLocaleString()} sats</p>
                  {(() => {
                    const discount = event.prepayDiscountSats ?? 0;
                    const hours = event.prepayDiscountHours ?? 3;
                    if (discount <= 0) return null;
                    const hoursBefore = (new Date(event.dateTime).getTime() - Date.now()) / (1000 * 60 * 60);
                    const qualifies = hoursBefore >= hours;
                    return qualifies ? (
                      <p className="text-green-400 text-sm mt-2">
                        🎉 Pay now and save {discount.toLocaleString()} sats — only {(event.buyInSats! - discount).toLocaleString()} sats!
                      </p>
                    ) : (
                      <p className="text-white/50 text-xs mt-2">
                        (Prepay discount expired — it required paying {hours}h+ before start.)
                      </p>
                    );
                  })()}
                </div>
                <div className="space-y-3">
                  <button
                    onClick={handlePayNow}
                    disabled={signupBusy}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black py-3 rounded-lg font-bold text-lg"
                  >
                    ⚡ Pay Now with Lightning
                  </button>
                  <button
                    onClick={handlePayOnArrival}
                    disabled={signupBusy}
                    className="w-full bg-blue-700 hover:bg-blue-600 disabled:opacity-60 text-white py-3 rounded-lg font-semibold"
                  >
                    💵 Pay on Arrival
                  </button>
                </div>
                <p className="text-white/50 text-xs text-center mt-3">
                  Pay on arrival registers you now; settle the buy-in in person at the venue.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
