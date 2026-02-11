'use client';

import { useState, useEffect } from 'react';
import { faqAPI } from '@/lib/api';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FaqTabProps {
  setMessage: (msg: string) => void;
  setError: (msg: string) => void;
}

export default function FaqTab({ setMessage, setError }: FaqTabProps) {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [form, setForm] = useState({ question: '', answer: '', sortOrder: 0 });

  useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    setLoading(true);
    try {
      const data = await faqAPI.getAllAdmin();
      setFaqs(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      await faqAPI.create({
        question: form.question,
        answer: form.answer,
        sortOrder: form.sortOrder,
      });
      setMessage('FAQ created successfully!');
      setForm({ question: '', answer: '', sortOrder: 0 });
      setShowForm(false);
      loadFaqs();
    } catch (err: any) {
      setError(err.message || 'Failed to create FAQ');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq) return;
    try {
      setError('');
      await faqAPI.update(editingFaq.id, {
        question: form.question,
        answer: form.answer,
        sortOrder: form.sortOrder,
      });
      setMessage('FAQ updated successfully!');
      setEditingFaq(null);
      setForm({ question: '', answer: '', sortOrder: 0 });
      loadFaqs();
    } catch (err: any) {
      setError(err.message || 'Failed to update FAQ');
    }
  };

  const handleToggleActive = async (faq: FAQ) => {
    try {
      setError('');
      await faqAPI.update(faq.id, { isActive: !faq.isActive });
      setMessage(`FAQ ${faq.isActive ? 'hidden' : 'shown'} successfully!`);
      loadFaqs();
    } catch (err: any) {
      setError(err.message || 'Failed to update FAQ');
    }
  };

  const handleDelete = async (faq: FAQ) => {
    if (!confirm(`Delete FAQ: "${faq.question}"?`)) return;
    try {
      setError('');
      await faqAPI.delete(faq.id);
      setMessage('FAQ deleted successfully!');
      loadFaqs();
    } catch (err: any) {
      setError(err.message || 'Failed to delete FAQ');
    }
  };

  const startEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setForm({ question: faq.question, answer: faq.answer, sortOrder: faq.sortOrder });
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingFaq(null);
    setForm({ question: '', answer: '', sortOrder: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">❓ FAQ Management</h2>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingFaq(null);
              setForm({ question: '', answer: '', sortOrder: faqs.length });
            }}
            className={`px-4 py-2 rounded text-sm font-semibold ${
              showForm ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {showForm ? '✕ Cancel' : '➕ Add FAQ'}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <form onSubmit={handleCreate} className="space-y-4 bg-gray-700/50 rounded-lg p-4 mb-4">
            <div>
              <label className="block text-gray-400 mb-1">Question *</label>
              <input
                type="text"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                placeholder="e.g., How do I sign up for an event?"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Answer *</label>
              <textarea
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                rows={4}
                placeholder="Write the answer here..."
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-32 p-3 bg-gray-700 border border-gray-600 rounded text-white"
              />
              <span className="text-gray-500 text-sm ml-2">Lower numbers appear first</span>
            </div>
            <button
              type="submit"
              disabled={!form.question.trim() || !form.answer.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-semibold"
            >
              ➕ Create FAQ
            </button>
          </form>
        )}

        {/* Edit Form */}
        {editingFaq && (
          <form onSubmit={handleUpdate} className="space-y-4 bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-blue-400">✏️ Editing FAQ</h3>
            <div>
              <label className="block text-gray-400 mb-1">Question *</label>
              <input
                type="text"
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Answer *</label>
              <textarea
                value={form.answer}
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
                required
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded text-white"
                rows={4}
              />
            </div>
            <div>
              <label className="block text-gray-400 mb-1">Sort Order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-32 p-3 bg-gray-700 border border-gray-600 rounded text-white"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!form.question.trim() || !form.answer.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded font-semibold"
              >
                💾 Save Changes
              </button>
            </div>
          </form>
        )}

        {/* FAQ List */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
            <p className="text-gray-400 mt-2">Loading FAQs...</p>
          </div>
        ) : faqs.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No FAQs yet. Click "Add FAQ" to create one!</p>
        ) : (
          <div className="space-y-3">
            {faqs.map((faq) => (
              <div
                key={faq.id}
                className={`bg-gray-700 p-4 rounded border-l-4 ${
                  faq.isActive ? 'border-green-500' : 'border-gray-500 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-500 text-xs">#{faq.sortOrder}</span>
                      {!faq.isActive && (
                        <span className="text-xs bg-gray-600 text-gray-400 px-2 py-0.5 rounded">Hidden</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-white">{faq.question}</h3>
                    <p className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{faq.answer}</p>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => startEdit(faq)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(faq)}
                      className={`text-sm ${
                        faq.isActive
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-green-400 hover:text-green-300'
                      }`}
                    >
                      {faq.isActive ? '👁️ Hide' : '👁️ Show'}
                    </button>
                    <button
                      onClick={() => handleDelete(faq)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
