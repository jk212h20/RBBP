/** Public routes that should render for anyone. */
export const PUBLIC_ROUTES: { path: string; name: string }[] = [
  { path: '/', name: 'home' },
  { path: '/events', name: 'events' },
  { path: '/leaderboard', name: 'leaderboard' },
  { path: '/venues', name: 'venues' },
  { path: '/store', name: 'store' },
  { path: '/blog', name: 'blog' },
  { path: '/faq', name: 'faq' },
  { path: '/puzzle', name: 'puzzle' },
  { path: '/login', name: 'login' },
  { path: '/register', name: 'register' },
  { path: '/venues/apply', name: 'venues-apply' },
];

/** Routes that require an authenticated session. */
export const AUTH_ROUTES: { path: string; name: string }[] = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/profile', name: 'profile' },
];
