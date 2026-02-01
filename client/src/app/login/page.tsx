'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { authAPI, getGoogleAuthUrl } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lightningData, setLightningData] = useState<{
    k1: string;
    qrCode: string;
    lnurl: string;
  } | null>(null);
  const [pollingLightning, setPollingLightning] = useState(false);

  const { login, loginWithToken, isAuthenticated } = useAuth();
  const router = useRouter();

  // Auto-load Lightning QR code on mount
  useEffect(() => {
    const loadLightningQR = async () => {
      try {
        const challenge = await authAPI.lightningChallenge();
        setLightningData(challenge);
        setPollingLightning(true);
      } catch (err) {
        console.error('Failed to load Lightning QR:', err);
      }
    };
    
    if (!isAuthenticated) {
      loadLightningQR();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Poll for Lightning auth status
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (lightningData && pollingLightning) {
      interval = setInterval(async () => {
        try {
          const status = await authAPI.lightningStatus(lightningData.k1);
          
          if (status.status === 'verified' && status.token) {
            setPollingLightning(false);
            await loginWithToken(status.token);
            router.push('/dashboard');
          } else if (status.status === 'expired') {
            setPollingLightning(false);
            setError('Lightning login expired. Please try again.');
            setLightningData(null);
          }
        } catch (err) {
          console.error('Lightning polling error:', err);
        }
      }, 2000);
    }

    return () => clearInterval(interval);
  }, [lightningData, pollingLightning, loginWithToken, router]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshLightning = async () => {
    setError('');
    try {
      const challenge = await authAPI.lightningChallenge();
      setLightningData(challenge);
      setPollingLightning(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh Lightning QR');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-black py-8">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">🃏 Roatan Poker</h1>
            <p className="text-gray-600 mt-2">Sign in to your account</p>
          </div>

          {/* Lightning QR - Always visible when loaded */}
          {lightningData && (
            <div className="mb-6 p-4 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-300">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  ⚡ Scan with Lightning Wallet for instant login
                </p>
                <div className="flex justify-center mb-3">
                  <img
                    src={lightningData.qrCode}
                    alt="Lightning Auth QR Code"
                    className="w-40 h-40 rounded-lg border-2 border-yellow-400 shadow-md"
                  />
                </div>
                <p className="text-xs text-gray-500 mb-1">
                  Phoenix • Wallet of Satoshi • Zeus • Blue Wallet
                </p>
                {pollingLightning && (
                  <p className="text-sm text-yellow-600 animate-pulse font-medium">
                    ⚡ Waiting for wallet...
                  </p>
                )}
                <button
                  onClick={handleRefreshLightning}
                  className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Refresh QR
                </button>
              </div>
            </div>
          )}

          {/* Loading state for Lightning */}
          {!lightningData && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-sm text-gray-500 animate-pulse">⚡ Loading Lightning QR...</p>
            </div>
          )}

          {/* Divider */}
          <div className="mb-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500">or use email</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Email Login Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500">or</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          {/* Google OAuth */}
          <a
            href={getGoogleAuthUrl()}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </a>

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="text-green-600 font-semibold hover:text-green-700">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
