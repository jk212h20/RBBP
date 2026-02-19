'use client';

import { useState, useEffect } from 'react';
import { puzzleAPI } from '@/lib/api';

interface PuzzleTabProps {
  setMessage: (msg: string) => void;
  setError: (msg: string) => void;
}

export default function PuzzleTab({ setMessage, setError }: PuzzleTabProps) {
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: '',
    scenario: '',
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: '',
    rewardSats: 500,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [puzzleData, statsData] = await Promise.all([
        puzzleAPI.getAllAdmin(),
        puzzleAPI.getStats(),
      ]);
      setPuzzles(puzzleData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load puzzles');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      date: '',
      scenario: '',
      question: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: '',
      rewardSats: 500,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const filteredOptions = form.options.filter((o) => o.trim() !== '');
      if (filteredOptions.length < 2) {
        setError('At least 2 options required');
        return;
      }
      if (form.correctIndex >= filteredOptions.length) {
        setError('Correct answer index is out of range');
        return;
      }

      const payload = {
        ...form,
        options: filteredOptions,
      };

      if (editingId) {
        await puzzleAPI.update(editingId, payload);
        setMessage('Puzzle updated!');
      } else {
        await puzzleAPI.create(payload);
        setMessage('Puzzle created!');
      }
      resetForm();
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save puzzle');
    }
  };

  const handleEdit = (puzzle: any) => {
    const opts = puzzle.options as string[];
    setForm({
      date: puzzle.date.split('T')[0],
      scenario: puzzle.scenario,
      question: puzzle.question,
      options: [...opts, ...Array(4 - opts.length).fill('')].slice(0, 5),
      correctIndex: puzzle.correctIndex,
      explanation: puzzle.explanation,
      rewardSats: puzzle.rewardSats,
    });
    setEditingId(puzzle.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this puzzle?')) return;
    try {
      await puzzleAPI.delete(id);
      setMessage('Puzzle deleted');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete puzzle');
    }
  };

  const updateOption = (idx: number, value: string) => {
    const newOpts = [...form.options];
    newOpts[idx] = value;
    setForm({ ...form, options: newOpts });
  };

  const addOption = () => {
    if (form.options.length < 5) {
      setForm({ ...form, options: [...form.options, ''] });
    }
  };

  const removeOption = (idx: number) => {
    if (form.options.length <= 2) return;
    const newOpts = form.options.filter((_, i) => i !== idx);
    let newCorrect = form.correctIndex;
    if (idx === form.correctIndex) newCorrect = 0;
    else if (idx < form.correctIndex) newCorrect--;
    setForm({ ...form, options: newOpts, correctIndex: newCorrect });
  };

  if (loading) {
    return <div className="text-center py-8 text-white/60">Loading puzzles...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalPuzzles}</div>
            <div className="text-white/50 text-xs">Total Puzzles</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalAttempts}</div>
            <div className="text-white/50 text-xs">Total Attempts</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.accuracy}%</div>
            <div className="text-white/50 text-xs">Accuracy</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">⚡ {stats.totalSatsAwarded}</div>
            <div className="text-white/50 text-xs">Sats Awarded</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.correctAttempts}</div>
            <div className="text-white/50 text-xs">Correct</div>
          </div>
        </div>
      )}

      {/* Add / Toggle Form */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">Puzzles</h3>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm"
        >
          {showForm ? 'Cancel' : '+ New Puzzle'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/5 rounded-lg p-6 space-y-4">
          <h4 className="text-white font-medium">{editingId ? 'Edit Puzzle' : 'Create Puzzle'}</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/60 text-sm mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-white/60 text-sm mb-1">Reward (sats)</label>
              <input
                type="number"
                value={form.rewardSats}
                onChange={(e) => setForm({ ...form, rewardSats: parseInt(e.target.value) || 500 })}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-1">Scenario (the hand/situation)</label>
            <textarea
              value={form.scenario}
              onChange={(e) => setForm({ ...form, scenario: e.target.value })}
              required
              rows={3}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              placeholder="You're on the button with A♠K♦. UTG raises 3x, MP calls..."
            />
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-1">Question</label>
            <input
              type="text"
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              required
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              placeholder="What is the best play here?"
            />
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-1">Options</label>
            <div className="space-y-2">
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctIndex"
                    checked={form.correctIndex === idx}
                    onChange={() => setForm({ ...form, correctIndex: idx })}
                    className="accent-green-500"
                    title="Mark as correct answer"
                  />
                  <span className="text-white/40 text-sm w-6">{String.fromCharCode(65 + idx)}.</span>
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                  />
                  {form.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {form.options.length < 5 && (
                <button
                  type="button"
                  onClick={addOption}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  + Add Option
                </button>
              )}
            </div>
            <p className="text-white/40 text-xs mt-1">Select the radio button for the correct answer</p>
          </div>

          <div>
            <label className="block text-white/60 text-sm mb-1">Explanation (shown after answering)</label>
            <textarea
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              required
              rows={2}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              placeholder="The correct play is to 3-bet because..."
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              {editingId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Puzzle List */}
      <div className="space-y-3">
        {puzzles.length === 0 ? (
          <div className="text-center py-8 text-white/50">No puzzles yet. Create one above!</div>
        ) : (
          puzzles.map((p) => (
            <div key={p.id} className="bg-white/5 rounded-lg p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white/40 text-xs">
                    {new Date(p.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-yellow-400 text-xs">⚡ {p.rewardSats}</span>
                  {p._count?.attempts > 0 && (
                    <span className="text-white/40 text-xs">
                      {p._count.attempts} attempt{p._count.attempts !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-white text-sm font-medium truncate">{p.question}</p>
                <p className="text-white/50 text-xs truncate">{p.scenario}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(p)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
