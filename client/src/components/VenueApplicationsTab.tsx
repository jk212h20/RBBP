'use client';

import { useState, useEffect } from 'react';
import { venueApplicationsAPI } from '@/lib/api';

interface VenueApplication {
  id: string;
  name: string;
  address: string;
  description: string | null;
  imageUrl: string | null;
  phone: string | null;
  email: string | null;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason: string | null;
  venueId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedBy: { id: string; name: string; email: string | null };
}

interface Props {
  setMessage: (msg: string) => void;
  setError: (msg: string) => void;
}

export default function VenueApplicationsTab({ setMessage, setError }: Props) {
  const [applications, setApplications] = useState<VenueApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('PENDING');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadApplications();
  }, [filter]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const data = await venueApplicationsAPI.getAll(filter || undefined);
      setApplications(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this venue application? A new venue will be created from the application details.')) return;
    setProcessing(id);
    try {
      setError('');
      await venueApplicationsAPI.approve(id);
      setMessage('Application approved! Venue has been created.');
      loadApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to approve application');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      setError('');
      await venueApplicationsAPI.reject(id, rejectionReason || undefined);
      setMessage('Application rejected.');
      setRejectingId(null);
      setRejectionReason('');
      loadApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to reject application');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this application permanently?')) return;
    setProcessing(id);
    try {
      setError('');
      await venueApplicationsAPI.delete(id);
      setMessage('Application deleted.');
      loadApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to delete application');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="bg-yellow-600/20 text-yellow-400 px-2 py-1 rounded text-xs">⏳ Pending</span>;
      case 'APPROVED':
        return <span className="bg-blue-600/20 text-blue-300 px-2 py-1 rounded text-xs">✅ Approved</span>;
      case 'REJECTED':
        return <span className="bg-red-600/20 text-red-400 px-2 py-1 rounded text-xs">❌ Rejected</span>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-bold">🏢 Venue Applications</h2>
        <div className="flex gap-2">
          {['PENDING', 'APPROVED', 'REJECTED', ''].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1 rounded text-sm ${
                filter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s === '' ? 'All' : s === 'PENDING' ? '⏳ Pending' : s === 'APPROVED' ? '✅ Approved' : '❌ Rejected'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
          <p className="text-gray-400 mt-2">Loading applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-400">No {filter ? filter.toLowerCase() : ''} applications found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div key={app.id} className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-white">{app.name}</h3>
                  <p className="text-gray-400 text-sm">📍 {app.address}</p>
                </div>
                {getStatusBadge(app.status)}
              </div>

              {app.description && (
                <p className="text-gray-300 text-sm mb-3">{app.description}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mb-3">
                <div className="bg-gray-600/50 rounded p-3">
                  <p className="text-gray-400 text-xs font-semibold mb-1">VENUE CONTACT</p>
                  {app.phone && <p className="text-gray-300">📞 {app.phone}</p>}
                  {app.email && <p className="text-gray-300">✉️ {app.email}</p>}
                  {!app.phone && !app.email && <p className="text-gray-500 italic">No venue contact provided</p>}
                </div>
                <div className="bg-gray-600/50 rounded p-3">
                  <p className="text-gray-400 text-xs font-semibold mb-1">APPLICANT</p>
                  <p className="text-gray-300">👤 {app.contactName}</p>
                  {app.contactEmail && <p className="text-gray-300">✉️ {app.contactEmail}</p>}
                  {app.contactPhone && <p className="text-gray-300">📞 {app.contactPhone}</p>}
                  <p className="text-gray-500 text-xs mt-1">
                    Account: {app.submittedBy.name} ({app.submittedBy.email || 'no email'})
                  </p>
                </div>
              </div>

              <p className="text-gray-500 text-xs mb-3">
                Submitted {new Date(app.createdAt).toLocaleDateString()} at {new Date(app.createdAt).toLocaleTimeString()}
              </p>

              {app.status === 'REJECTED' && app.rejectionReason && (
                <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-3">
                  <p className="text-red-400 text-sm"><strong>Rejection reason:</strong> {app.rejectionReason}</p>
                </div>
              )}

              {/* Action Buttons */}
              {app.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(app.id)}
                    disabled={processing === app.id}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm font-semibold"
                  >
                    {processing === app.id ? '⏳...' : '✅ Approve & Create Venue'}
                  </button>
                  <button
                    onClick={() => setRejectingId(rejectingId === app.id ? null : app.id)}
                    disabled={processing === app.id}
                    className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm font-semibold"
                  >
                    ❌ Reject
                  </button>
                </div>
              )}

              {/* Rejection Reason Input */}
              {rejectingId === app.id && (
                <div className="mt-3 bg-gray-600/50 rounded p-3">
                  <label className="block text-gray-400 text-sm mb-1">Rejection Reason (optional)</label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    rows={2}
                    placeholder="Explain why the application was rejected..."
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleReject(app.id)}
                      disabled={processing === app.id}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                    >
                      {processing === app.id ? '⏳...' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                      className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Delete for non-pending */}
              {app.status !== 'PENDING' && (
                <div className="mt-3">
                  <button
                    onClick={() => handleDelete(app.id)}
                    disabled={processing === app.id}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    🗑️ Delete Application
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
