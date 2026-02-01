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
    fetchAPI<{ status: string; token?: string; user?: any; isNew?: boolean }>(
      `/auth/lightning/status/${k1}`
    ),
};

// Google OAuth URL
export const getGoogleAuthUrl = () => `${API_URL}/auth/google`;

// ============================================
// VENUES API
// ============================================
export const venuesAPI = {
  getAll: () => fetchAPI<any[]>('/venues'),
  
  getById: (id: string) => fetchAPI<any>(`/venues/${id}`),
  
  create: (data: { name: string; address: string; description?: string; phone?: string; email?: string }) =>
    fetchAPI<any>('/venues', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id: string, data: Partial<{ name: string; address: string; description?: string; phone?: string; email?: string }>) =>
    fetchAPI<any>(`/venues/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/venues/${id}`, { method: 'DELETE' }),
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
  
  update: (id: string, data: Partial<{ 
    name: string; 
    dateTime: string; 
    description?: string;
    maxPlayers?: number;
    buyIn?: number;
    status?: string;
  }>) =>
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
  
  // Results
  enterResults: (eventId: string, results: { userId: string; position: number; knockouts?: number }[]) =>
    fetchAPI<any[]>(`/events/${eventId}/results`, {
      method: 'POST',
      body: JSON.stringify({ results }),
    }),
  
  getResults: (eventId: string) => fetchAPI<any[]>(`/events/${eventId}/results`),
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
};

// ============================================
// STANDINGS API
// ============================================
export const standingsAPI = {
  getCurrent: () => fetchAPI<{ season: any; standings: any[] }>('/standings'),
  
  getBySeason: (seasonId: string) => 
    fetchAPI<{ season: any; standings: any[] }>(`/standings/season/${seasonId}`),
  
  getByPlayer: (playerId: string) => fetchAPI<any>(`/standings/player/${playerId}`),
};

// Default export for simple usage
const api = {
  get: <T>(endpoint: string) => fetchAPI<T>(endpoint),
  post: <T>(endpoint: string, data?: any) => fetchAPI<T>(endpoint, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(endpoint: string, data?: any) => fetchAPI<T>(endpoint, { method: 'PUT', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(endpoint: string) => fetchAPI<T>(endpoint, { method: 'DELETE' }),
};

export default api;
