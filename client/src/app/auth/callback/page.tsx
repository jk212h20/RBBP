'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const { loginWithToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      const token = searchParams.get('token');
      const errorParam = searchParams.get('error');
      const isNew = searchParams.get('isNew') === 'true';

      if (errorParam) {
        setError(errorParam);
        return;
      }

      if (token) {
        try {
          await loginWithToken(token);
          
          // Redirect with welcome message if new user
          if (isNew) {
            router.push('/dashboard?welcome=true');
          } else {
            router.push('/dashboard');
          }
        } catch (err) {
          setError('Failed to complete authentication');
        }
      } else {
        setError('No authentication token received');
      }
    };

    handleCallback();
  }, [searchParams, loginWithToken, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-black">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4">
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Authentication Failed
            </h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-900 via-green-800 to-black">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h1 className="text-xl font-bold text-gray-900">
            Completing authentication...
          </h1>
          <p className="text-gray-600 mt-2">Please wait</p>
        </div>
      </div>
    </div>
  );
}
