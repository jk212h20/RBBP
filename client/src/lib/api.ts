// Use Railway's injected API URL or fallback to localhost
const API_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
    ? `https://${window.location.hostname.replace('client', 'server')}/api`
    : 'http://localhost:3001/api');

// Generic fetch wrapper with auth
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'API request failed');
  }

  return data;
}

// Auth API calls
export const authAPI = {
  register: (data: { email: string; password: string; name: string }) =>
    fetchAPI<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    fetchAPI<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () => fetchAPI<{ user: any }>('/auth/me'),

  logout: () =>
    fetchAPI<{ message: string }>('/auth/logout', { method: 'POST' }),

  providers: () =>
    fetchAPI<{ providers: { email: boolean; google: boolean; lightning: boolean } }>(
      '/auth/providers'
    ),

  // Lightning auth
  lightningChallenge: () =>
    fetchAPI<{ k1: string; lnurl: string; qrCode: string; expiresIn: number }>(
      '/auth/lightning/challenge'
    ),

  lightningStatus: (k1: string) =>
    fetchAPI<{ status: string; token?: string; user?: any; isNew?: boolean; lightningBonusAwarded?: boolean }>(
      `/auth/lightning/status/${k1}`
    ),

  updateProfile: (data: { name?: string; email?: string }) =>
    fetchAPI<{ message: string; user: any; token: string }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Link Lightning wallet to existing account
  linkLightningChallenge: () =>
    fetchAPI<{ k1: string; lnurl: string; qrCode: string; expiresIn: number }>(
      '/auth/link-lightning/challenge'
    ),

  linkLightningStatus: (k1: string) =>
    fetchAPI<{ status: string; user?: any; token?: string; lightningBonusAwarded?: boolean }>(
      `/auth/link-lightning/status/${k1}`
    ),

  // Add email/password to existing account
  addEmail: (data: { email: string; password: string }) =>
    fetchAPI<{ message: string; user: any; token: string }>('/auth/add-email', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Profile details (bio, profileImage)
  getProfileDetails: () =>
    fetchAPI<{ profile: { bio: string; profileImage: string | null } }>('/auth/profile/details'),

  updateProfileDetails: (data: { bio?: string; profileImage?: string | null }) =>
    fetchAPI<{ message: string; profile: { bio: string; profileImage: string | null } }>('/auth/profile/details', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Google OAuth URL
export const getGoogleAuthUrl = () => `${API_URL}/auth/google`;

// ============================================
// VENUES API
// ============================================
export const venuesAPI = {
  getAll: (includeInactive = false) => 
    fetchAPI<any[]>(`/venues${includeInactive ? '?includeInactive=true' : ''}`),
  
  getById: (id: string) => fetchAPI<any>(`/venues/${id}`),
  
  create: (data: { name: string; address: string; description?: string; phone?: string; email?: string; managerId?: string; imageUrl?: string | null }) =>
    fetchAPI<any>('/venues', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<{ name: string; address: string; description?: string; phone?: string; email?: string; isActive?: boolean; imageUrl?: string | null }>) =>
    fetchAPI<any>(`/venues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string, hard = false) =>
    fetchAPI<{ message: string }>(`/venues/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' }),
  
  assignManager: (venueId: string, managerId: string | null) =>
    fetchAPI<any>(`/venues/${venueId}/manager`, {
      method: 'PUT',
      body: JSON.stringify({ managerId }),
    }),
};

// ============================================
// SEASONS API
// ============================================
export const seasonsAPI = {
  getAll: () => fetchAPI<any[]>('/seasons'),
  
  getById: (id: string) => fetchAPI<any>(`/seasons/${id}`),
  
  getCurrent: () => fetchAPI<any>('/seasons/current'),
  
  getStandings: (id: string, limit = 50) => 
    fetchAPI<any[]>(`/seasons/${id}/standings?limit=${limit}`),
  
  create: (data: { name: string; startDate: string; endDate: string; isActive?: boolean; pointsStructure?: Record<string, number> }) =>
    fetchAPI<any>('/seasons', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<{ name: string; startDate: string; endDate: string; isActive?: boolean }>) =>
    fetchAPI<any>(`/seasons/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  activate: (id: string) =>
    fetchAPI<any>(`/seasons/${id}/activate`, { method: 'PUT' }),
  
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/seasons/${id}`, { method: 'DELETE' }),
};

// ============================================
// EVENTS API
// ============================================
export const eventsAPI = {
  getAll: (filters?: { seasonId?: string; venueId?: string; upcoming?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.seasonId) params.append('seasonId', filters.seasonId);
    if (filters?.venueId) params.append('venueId', filters.venueId);
    if (filters?.upcoming) params.append('upcoming', 'true');
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchAPI<any[]>(`/events${query}`);
  },
  
  getUpcoming: (limit = 10) => fetchAPI<any[]>(`/events/upcoming?limit=${limit}`),
  
  getById: (id: string) => fetchAPI<any>(`/events/${id}`),
  
  getMy: () => fetchAPI<any[]>('/events/my'),
  
  create: (data: { 
    name: string; 
    dateTime: string; 
    venueId: string; 
    seasonId: string; 
    description?: string;
    maxPlayers?: number;
    buyIn?: number;
  }) =>
    fetchAPI<any>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: any) =>
    fetchAPI<any>(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateStatus: (id: string, status: string) =>
    fetchAPI<any>(`/events/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/events/${id}`, { method: 'DELETE' }),
  
  // Signups
  signup: (eventId: string) =>
    fetchAPI<any>(`/events/${eventId}/signup`, { method: 'POST' }),
  
  cancelSignup: (eventId: string) =>
    fetchAPI<{ message: string }>(`/events/${eventId}/signup`, { method: 'DELETE' }),
  
  getSignups: (eventId: string) => fetchAPI<any[]>(`/events/${eventId}/signups`),
  
  checkIn: (eventId: string, userId: string) =>
    fetchAPI<any>(`/events/${eventId}/checkin/${userId}`, { method: 'PUT' }),

  removePlayer: (eventId: string, userId: string) =>
    fetchAPI<{ message: string }>(`/events/${eventId}/signup/${userId}`, { method: 'DELETE' }),
  
  // Results
  enterResults: (eventId: string, results: { userId: string; position: number; knockouts?: number }[]) =>
    fetchAPI<any[]>(`/events/${eventId}/results`, {
      method: 'POST',
      body: JSON.stringify({ results }),
    }),
  
  getResults: (eventId: string) => fetchAPI<any[]>(`/events/${eventId}/results`),
  
  // Points preview
  getPointsPreview: (eventId: string) => 
    fetchAPI<{ first: number; second: number; third: number; totalPool: number; playerCount: number }>(
      `/events/${eventId}/points-preview`
    ),
  
  // Waitlist
  getWaitlistPosition: (eventId: string) => 
    fetchAPI<{ position: number | null }>(`/events/${eventId}/waitlist-position`),
  
  // Bulk event creation
  createBulk: (data: {
    baseName: string;
    startDate: string;
    time: string;
    dayOfWeek: number;
    numberOfWeeks: number;
    venueId: string;
    seasonId: string;
    description?: string;
    maxPlayers?: number;
    buyIn?: number;
    startingNumber?: number;
  }) =>
    fetchAPI<{ message: string; events: any[] }>('/events/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Quick Add Player (TD/Admin)
  searchPlayers: (eventId: string, query: string) =>
    fetchAPI<{ id: string; name: string; email: string | null; isGuest: boolean }[]>(
      `/events/${eventId}/search-players?q=${encodeURIComponent(query)}`
    ),

  quickAddPlayer: (eventId: string, data: { userId?: string; name?: string }) =>
    fetchAPI<any>(`/events/${eventId}/quick-add`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Total Entrants Override (TD/Admin)
  setTotalEntrants: (eventId: string, totalEntrants: number | null) =>
    fetchAPI<{ id: string; totalEntrants: number | null }>(`/events/${eventId}/total-entrants`, {
      method: 'PUT',
      body: JSON.stringify({ totalEntrants }),
    }),

  // Last Longer Pool
  getLastLongerPool: (eventId: string) =>
    fetchAPI<{
      enabled: boolean;
      seedSats: number;
      entrySats: number;
      totalPot: number;
      entryCount: number;
      entries: { id: string; userId: string; userName: string; paidAt: string }[];
      winnerId: string | null;
      winnerName: string | null;
      userEntry: { id: string; status: string; paidAt: string | null } | null;
    }>(`/events/${eventId}/last-longer`),

  enterLastLonger: (eventId: string) =>
    fetchAPI<{
      entry: { id: string; status: string };
      invoice: { paymentRequest: string; paymentHash: string; amountSats: number; expiresAt: string };
    }>(`/events/${eventId}/last-longer/enter`, { method: 'POST' }),

  checkLastLongerPayment: (eventId: string, _entryId?: string) =>
    fetchAPI<{
      paid: boolean;
      paidAt?: string;
    }>(`/events/${eventId}/last-longer/check-payment`),

  selectLastLongerWinner: (eventId: string, winnerId: string) =>
    fetchAPI<{
      message: string;
      winnerId: string;
      winnerName: string;
      prizeAmount: number;
    }>(`/events/${eventId}/last-longer/winner`, {
      method: 'POST',
      body: JSON.stringify({ winnerId }),
    }),
};

// ============================================
// ADMIN API
// ============================================
export const adminAPI = {
  getStats: () => fetchAPI<{ users: number; venues: number; events: number; seasons: number }>('/admin/stats'),
  
  getUsers: () => fetchAPI<any[]>('/admin/users'),
  
  promoteToAdmin: (secretKey: string) =>
    fetchAPI<{ message: string; user: any; token?: string }>('/admin/promote', {
      method: 'POST',
      body: JSON.stringify({ secretKey }),
    }),
  
  updateUserRole: (userId: string, role: string) =>
    fetchAPI<any>(`/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    }),
  
  updateUserStatus: (userId: string, isActive: boolean) =>
    fetchAPI<any>(`/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    }),
  
  deleteUser: (userId: string, reason?: string) =>
    fetchAPI<{ message: string; deletedUser: { id: string; name: string; email: string | null } }>(
      `/admin/users/${userId}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
      }
    ),
  
  getDeletedUsers: () => fetchAPI<any[]>('/admin/deleted-users'),
  fixEventTimes: () => fetchAPI<any>('/admin/fix-event-times', { method: 'POST' }),
  
  // Points management
  getMigrationStatus: () => fetchAPI<{ pointsHistoryEnabled: boolean }>('/admin/migration-status'),
  
  runMigration: () => fetchAPI<{ message: string; success?: boolean; alreadyApplied?: boolean }>('/admin/run-migration', {
    method: 'POST',
  }),
  
  awardPoints: (data: { userId: string; seasonId: string; points: number; reason: string }) =>
    fetchAPI<{ message: string; historyRecord: any }>('/admin/points/award', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getPointsUsers: () => fetchAPI<{ season: any; users: any[] }>('/admin/points/users'),
  
  getPointsHistory: (userId: string, seasonId?: string) => {
    const query = seasonId ? `?seasonId=${seasonId}` : '';
    return fetchAPI<any[]>(`/admin/points/history/${userId}${query}`);
  },
  
  getUserDetails: (userId: string) => fetchAPI<any>(`/admin/users/${userId}/details`),
  
  updateUserNotes: (userId: string, notes: string) =>
    fetchAPI<{ id: string; adminNotes: string }>(`/admin/users/${userId}/notes`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

  // Guest merge
  getGuestUsers: () => fetchAPI<{
    id: string;
    name: string;
    createdAt: string;
    _count: { results: number; eventSignups: number; standings: number };
  }[]>('/admin/guest-users'),

  mergeGuest: (guestUserId: string, realUserId: string) =>
    fetchAPI<{
      message: string;
      mergedData: { results: number; standings: number; signups: number };
    }>('/admin/merge-guest', {
      method: 'POST',
      body: JSON.stringify({ guestUserId, realUserId }),
    }),

  // Guest claim link
  generateClaimLink: (guestUserId: string) =>
    fetchAPI<{
      claimUrl: string;
      token: string;
      expiresAt: string;
      guestName: string;
    }>(`/admin/guest-users/${guestUserId}/claim-link`, {
      method: 'POST',
    }),
};

// ============================================
// STANDINGS API
// ============================================
export const standingsAPI = {
  getCurrent: () => fetchAPI<{ season: any; standings: any[] }>('/standings'),
  
  getMy: () => fetchAPI<{ season: any; standing: any }>('/standings/my'),
  
  getBySeason: (seasonId: string) => 
    fetchAPI<{ season: any; standings: any[] }>(`/standings/season/${seasonId}`),
  
  getByPlayer: (playerId: string) => fetchAPI<any>(`/standings/player/${playerId}`),
  
  getUserHistory: (userId: string) => fetchAPI<any[]>(`/standings/user/${userId}/history`),
};

// ============================================
// WITHDRAWALS API (Lightning Payouts)
// ============================================
export const withdrawalsAPI = {
  // Admin endpoints
  create: (data: { userId: string; amountSats: number; description?: string; expiresInHours?: number }) =>
    fetchAPI<{ 
      withdrawal: { id: string; k1: string; amountSats: number; status: string; expiresAt: string };
      lnurl: string;
      qrData: string;
      lightningUri: string;
    }>('/withdrawals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getAll: (filters?: { status?: string; userId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.userId) params.append('userId', filters.userId);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchAPI<any[]>(`/withdrawals${query}`);
  },
  
  getById: (id: string) => fetchAPI<any>(`/withdrawals/${id}`),
  
  cancel: (id: string) => fetchAPI<{ message: string }>(`/withdrawals/${id}`, { method: 'DELETE' }),
  
  getStats: () => fetchAPI<{ pending: number; paid: number; failed: number; totalPaidSats: number }>('/withdrawals/stats'),
  
  getNodeStatus: () => fetchAPI<{ 
    configured: boolean; 
    connected: boolean; 
    nodeAlias?: string; 
    balanceSats?: number;
    pendingSats?: number;
    error?: string;
  }>('/withdrawals/node-status'),
  
  cleanup: () => fetchAPI<{ message: string }>('/withdrawals/cleanup', { method: 'POST' }),
  
  // User endpoints
  getMy: () => fetchAPI<any[]>('/withdrawals/my'),
  
  getMyById: (id: string) => fetchAPI<any>(`/withdrawals/my/${id}`),
};

// ============================================
// BALANCE API (Lightning Balance)
// ============================================
export const balanceAPI = {
  // User endpoints
  get: () => fetchAPI<{ balanceSats: number }>('/balance'),
  
  withdraw: (amountSats?: number) =>
    fetchAPI<{
      withdrawal: { id: string; k1: string; amountSats: number; status: string; expiresAt: string };
      lnurl: string;
      qrData: string;
      lightningUri: string;
    }>('/balance/withdraw', {
      method: 'POST',
      body: JSON.stringify({ amountSats }),
    }),
  
  getWithdrawalStatus: (withdrawalId: string) =>
    fetchAPI<{ id: string; status: string; amountSats: number; paidAt: string | null }>(
      `/balance/withdrawal/${withdrawalId}/status`
    ),
  
  // Admin endpoints
  getAllUsers: () => fetchAPI<{
    id: string;
    name: string;
    email: string | null;
    lightningBalanceSats: number;
    role: string;
  }[]>('/balance/admin/all'),
  
  getUsersWithBalance: () => fetchAPI<{
    id: string;
    name: string;
    email: string | null;
    lightningBalanceSats: number;
  }[]>('/balance/admin/with-balance'),
  
  getStats: () => fetchAPI<{
    totalOutstanding: number;
    usersWithBalance: number;
    averageBalance: number;
    maxBalance: number;
  }>('/balance/admin/stats'),
  
  credit: (data: { userId: string; amountSats: number; reason?: string }) =>
    fetchAPI<{ userId: string; newBalance: number; credited: number }>('/balance/admin/credit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getUserBalance: (userId: string) =>
    fetchAPI<{ userId: string; balanceSats: number }>(`/balance/admin/user/${userId}`),
};

// ============================================
// FAQ API
// ============================================
export const faqAPI = {
  getAll: () => fetchAPI<{ id: string; question: string; answer: string; sortOrder: number }[]>('/faq'),

  getAllAdmin: () => fetchAPI<{ id: string; question: string; answer: string; sortOrder: number; isActive: boolean; createdAt: string; updatedAt: string }[]>('/faq/all'),

  create: (data: { question: string; answer: string; sortOrder?: number }) =>
    fetchAPI<any>('/faq', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ question: string; answer: string; sortOrder: number; isActive: boolean }>) =>
    fetchAPI<any>(`/faq/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/faq/${id}`, { method: 'DELETE' }),
};

// ============================================
// VENUE APPLICATIONS API
// ============================================
export const venueApplicationsAPI = {
  submit: (data: {
    name: string;
    address: string;
    description?: string;
    imageUrl?: string | null;
    phone?: string;
    email?: string;
    contactName: string;
    contactEmail?: string;
    contactPhone?: string;
  }) =>
    fetchAPI<any>('/venue-applications', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMine: () => fetchAPI<any[]>('/venue-applications/mine'),

  // Admin
  getAll: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return fetchAPI<any[]>(`/venue-applications${query}`);
  },

  getById: (id: string) => fetchAPI<any>(`/venue-applications/${id}`),

  getPendingCount: () => fetchAPI<{ count: number }>('/venue-applications/pending-count'),

  approve: (id: string) =>
    fetchAPI<any>(`/venue-applications/${id}/approve`, { method: 'POST' }),

  reject: (id: string, rejectionReason?: string) =>
    fetchAPI<any>(`/venue-applications/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    }),

  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/venue-applications/${id}`, { method: 'DELETE' }),
};

// Players API (public profiles)
export const playersAPI = {
  getProfile: (id: string) => fetchAPI<any>(`/auth/players/${id}`),
};

// Profile API (authenticated user's own profile)
export const profileAPI = {
  updateSocialLinks: (socialLinks: Record<string, string>) =>
    fetchAPI<any>('/auth/profile/social-links', {
      method: 'PUT',
      body: JSON.stringify({ socialLinks }),
    }),
};

// Default export for simple usage
const api = {
  get: <T>(endpoint: string) => fetchAPI<T>(endpoint),
  post: <T>(endpoint: string, data?: any) => fetchAPI<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(endpoint: string, data?: any) => fetchAPI<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(endpoint: string) => fetchAPI<T>(endpoint, { method: 'DELETE' }),
};

export default api;
