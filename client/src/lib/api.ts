const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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
