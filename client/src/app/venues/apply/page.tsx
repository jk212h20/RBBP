'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { venueApplicationsAPI } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function VenueApplyPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  const [form, setForm] = useState({
    name: '',
    address: '',
    description: '',
    phone: '',
    email: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      loadMyApplications();
      // Pre-fill contact info from user
      setForm(prev => ({
        ...prev,
        contactName: user.name || '',
        contactEmail: user.email || '',
      }));
    }
  }, [user]);

  const loadMyApplications = async () => {
    try {
      const apps = await venueApplicationsAPI.getMine();
      setMyApplications(apps);
    } catch (err) {
      console.error('Failed to load applications:', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await venueApplicationsAPI.submit(form);
      setSuccess(true);
      setForm({
        name: '',
        address: '',
        description: '',
        phone: '',
        email: '',
        contactName: user?.name || '',
        contactEmail: user?.email || '',
        contactPhone: '',
      });
      loadMyApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs">⏳ Pending</span>;
      case 'APPROVED':
        return <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full text-xs">✅ Approved</span>;
      case 'REJECTED':
        return <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-full text-xs">❌ Rejected</span>;
      default:
        return <span className="bg-gray-500/20 text-gray-400 px-2 py-1 rounded-full text-xs">{status}</span>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <MobileNav currentPage="venues" />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link href="/venues" className="text-blue-300 hover:text-blue-200 mb-6 inline-block">
          ← Back to Venues
        </Link>

        {/* Page Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🏢 Apply to Add a Venue</h1>
          <p className="text-blue-100">
            Want to host poker nights at your venue? Submit an application and our team will review it.
          </p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="mb-6 bg-blue-500/20 border border-blue-500/30 rounded-xl p-4">
            <p className="text-blue-300 font-semibold">✅ Application Submitted!</p>
            <p className="text-blue-100 text-sm mt-1">
              Your venue application has been submitted for review. We&apos;ll notify you once it&apos;s been reviewed.
            </p>
            <button
              onClick={() => setSuccess(false)}
              className="mt-2 text-blue-300 hover:text-blue-200 text-sm underline"
            >
              Submit another application
            </button>
          </div>
        )}

        {/* Application Form */}
        {!success && (
          <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Venue Details</h2>

            {error && (
              <div className="mb-4 bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {/* Venue Name */}
              <div>
                <label className="block text-blue-100 text-sm font-medium mb-1">
                  Venue Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white/10 border border-blue-600/30 rounded-lg px-4 py-2 text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Sundowners Beach Bar"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-blue-100 text-sm font-medium mb-1">
                  Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-white/10 border border-blue-600/30 rounded-lg px-4 py-2 text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., West Bay Beach, Roatan"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-blue-100 text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full bg-white/10 border border-blue-600/30 rounded-lg px-4 py-2 text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                  placeholder="Tell us about the venue, available space, etc."
                />
              </div>

              {/* Venue Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-100 text-sm font-medium mb-1">
                    Venue Phone
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-white/10 border border-blue-600/30 rounded-lg px-4 py-2 text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                    placeholder="Venue phone number"
                  />
                </div>
                <div>
                  <label className="block text-blue-100 text-sm font-medium mb-1">
                    Venue Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-white/10 border border-blue-600/30 rounded-lg px-4 py-2 text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                    placeholder="venue@example.com"
                  />
                </div>
              </div>

              <hr className="border-blue-600/30" />

              <h2 className="text-xl font-bold text-white">Your Contact Info</h2>

              {/* Contact Name */}
              <div>
                <label className="block text-blue-100 text-sm font-medium mb-1">
                  Your Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full bg-white/10 border border-blue-600/30 rounded-lg px-4 py-2 text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                  placeholder="Your full name"
                />
              </div>

              {/* Contact Email & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-blue-100 text-sm font-medium mb-1">
                    Your Email
                  </label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="w-full bg-white/10 border border-blue-600/30 rounded-lg px-4 py-2 text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-blue-100 text-sm font-medium mb-1">
                    Your Phone
                  </label>
                  <input
                    type="text"
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="w-full bg-white/10 border border-blue-600/30 rounded-lg px-4 py-2 text-white placeholder-blue-200/40 focus:outline-none focus:border-blue-500"
                    placeholder="Your phone number"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-bold py-3 rounded-lg transition"
            >
              {submitting ? 'Submitting...' : '📨 Submit Application'}
            </button>
          </form>
        )}

        {/* My Applications */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6">
          <h2 className="text-xl font-bold text-white mb-4">My Applications</h2>

          {loadingApps ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            </div>
          ) : myApplications.length === 0 ? (
            <p className="text-blue-200/60 text-sm">You haven&apos;t submitted any applications yet.</p>
          ) : (
            <div className="space-y-3">
              {myApplications.map((app) => (
                <div
                  key={app.id}
                  className="bg-white/5 rounded-lg p-4 border border-blue-600/20"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-white font-semibold">{app.name}</h3>
                      <p className="text-blue-100 text-sm">📍 {app.address}</p>
                      <p className="text-blue-200/50 text-xs mt-1">
                        Submitted {new Date(app.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                  {app.status === 'REJECTED' && app.rejectionReason && (
                    <div className="mt-2 bg-red-500/10 rounded-lg p-2">
                      <p className="text-red-300 text-sm">
                        <strong>Reason:</strong> {app.rejectionReason}
                      </p>
                    </div>
                  )}
                  {app.status === 'APPROVED' && app.venueId && (
                    <div className="mt-2">
                      <Link
                        href={`/venues`}
                        className="text-blue-300 hover:text-blue-200 text-sm underline"
                      >
                        View venue →
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
