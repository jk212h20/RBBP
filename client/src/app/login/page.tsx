'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import MobileNav from '@/components/MobileNav';
import { authAPI } from '@/lib/api';

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

  const [lightningError, setLightningError] = useState('');

  // Auto-load Lightning QR code on mount
  useEffect(() => {
    const loadLightningQR = async () => {
      try {
        setLightningError('');
        console.log('Requesting Lightning challenge...');
        const challenge = await authAPI.lightningChallenge();
        console.log('Lightning challenge received:', challenge);
        setLightningData(challenge);
        setPollingLightning(true);
      } catch (err: any) {
        console.error('Failed to load Lightning QR:', err);
        setLightningError(err.message || 'Failed to load Lightning QR');
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
            // Redirect with lightning bonus flag if awarded
            if (status.lightningBonusAwarded) {
              router.push('/dashboard?lightningBonus=true');
            } else {
              router.push('/dashboard');
            }
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
    setLightningError('');
    try {
      console.log('Refreshing Lightning challenge...');
      const challenge = await authAPI.lightningChallenge();
      console.log('Lightning challenge refreshed:', challenge);
      setLightningData(challenge);
      setPollingLightning(true);
    } catch (err: any) {
      console.error('Failed to refresh Lightning QR:', err);
      setLightningError(err.message || 'Failed to refresh Lightning QR');
    }
  };

  return (
    <div className="min-h-screen page-gradient-auth">
      <MobileNav />
      <div className="flex items-center justify-center py-8">
      <div className="max-w-md w-full mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center justify-center gap-2"><Image src="/logo.png" alt="RBBP" width={32} height={32} /> Roatan Bitcoin Bar Poker</h1>
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
                    className="w-32 h-32 sm:w-40 sm:h-40 rounded-lg border-2 border-yellow-400 shadow-md"
                  />
                </div>
                <a
                  href={`lightning:${lightningData.lnurl}`}
                  className="block text-center text-sm text-yellow-600 hover:text-yellow-700 font-medium mb-2 underline"
                >
                  📱 Tap to open wallet (mobile)
                </a>
                <p className="text-xs text-gray-500 mb-1">
                  <a href="https://phoenix.acinq.co" target="_blank" rel="noopener noreferrer" className="text-yellow-600 hover:text-yellow-700 underline">Phoenix</a> • Wallet of Satoshi • Zeus • Blue Wallet
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
          {!lightningData && !lightningError && (
            <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
              <p className="text-sm text-gray-500 animate-pulse">⚡ Loading Lightning QR...</p>
            </div>
          )}

          {/* Lightning Error */}
          {lightningError && (
            <div className="mb-6 p-4 bg-red-50 rounded-xl border border-red-200 text-center">
              <p className="text-sm text-red-600 mb-2">⚡ Lightning Error: {lightningError}</p>
              <button
                onClick={handleRefreshLightning}
                className="text-sm text-red-500 hover:text-red-700 underline"
              >
                Try Again
              </button>
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
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
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Register Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/register" className="text-blue-500 font-semibold hover:text-blue-600">
              Sign up
            </Link>
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}
