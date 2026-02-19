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
  const [reordering, setReordering] = useState(false);
  const [form, setForm] = useState({
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

  // Split puzzles into used and queued
  const usedPuzzles = puzzles.filter((p) => p.usedAt);
  const queuedPuzzles = puzzles
    .filter((p) => !p.usedAt && p.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const inactivePuzzles = puzzles.filter((p) => !p.usedAt && !p.isActive);

  const resetForm = () => {
    setForm({
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
        setMessage('Puzzle created and added to end of queue!');
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

  const handleToggleActive = async (puzzle: any) => {
    try {
      await puzzleAPI.update(puzzle.id, { isActive: !puzzle.isActive });
      setMessage(puzzle.isActive ? 'Puzzle deactivated' : 'Puzzle reactivated');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update puzzle');
    }
  };

  const moveInQueue = async (index: number, direction: 'up' | 'down') => {
    const newQueue = [...queuedPuzzles];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQueue.length) return;

    [newQueue[index], newQueue[targetIndex]] = [newQueue[targetIndex], newQueue[index]];

    setReordering(true);
    try {
      await puzzleAPI.reorder(newQueue.map((p) => p.id));
      await loadData();
      setMessage('Queue reordered');
    } catch (err: any) {
      setError(err.message || 'Failed to reorder');
    } finally {
      setReordering(false);
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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalPuzzles}</div>
            <div className="text-white/50 text-xs">Total Puzzles</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.queuedPuzzles}</div>
            <div className="text-white/50 text-xs">In Queue</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white/60">{stats.usedPuzzles}</div>
            <div className="text-white/50 text-xs">Used</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalAttempts}</div>
            <div className="text-white/50 text-xs">Attempts</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.accuracy}%</div>
            <div className="text-white/50 text-xs">Accuracy</div>
          </div>
          <div className="bg-white/5 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">⚡ {stats.totalSatsAwarded}</div>
            <div className="text-white/50 text-xs">Sats Awarded</div>
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
          <h4 className="text-white font-medium">{editingId ? 'Edit Puzzle' : 'Create Puzzle (added to end of queue)'}</h4>

          <div>
            <label className="block text-white/60 text-sm mb-1">Reward (sats)</label>
            <input
              type="number"
              value={form.rewardSats}
              onChange={(e) => setForm({ ...form, rewardSats: parseInt(e.target.value) || 500 })}
              className="w-32 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
            />
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

      {/* ===== QUEUED PUZZLES (reorderable) ===== */}
      <div>
        <h4 className="text-white font-medium mb-3 flex items-center gap-2">
          📋 Queue ({queuedPuzzles.length} puzzles)
          <span className="text-white/40 text-xs font-normal">— next puzzle shown is #1</span>
        </h4>
        {queuedPuzzles.length === 0 ? (
          <div className="text-center py-6 text-white/40 bg-white/5 rounded-lg">
            No puzzles in queue. Create some above!
          </div>
        ) : (
          <div className="space-y-2">
            {queuedPuzzles.map((p, idx) => (
              <div
                key={p.id}
                className="bg-white/5 rounded-lg p-3 flex items-center gap-3"
              >
                {/* Position + arrows */}
                <div className="flex flex-col items-center gap-0.5 w-10 shrink-0">
                  <button
                    onClick={() => moveInQueue(idx, 'up')}
                    disabled={idx === 0 || reordering}
                    className={`text-xs px-1 ${idx === 0 ? 'text-white/10' : 'text-white/50 hover:text-white'}`}
                  >
                    ▲
                  </button>
                  <span className="text-white/60 text-sm font-mono">#{idx + 1}</span>
                  <button
                    onClick={() => moveInQueue(idx, 'down')}
                    disabled={idx === queuedPuzzles.length - 1 || reordering}
                    className={`text-xs px-1 ${idx === queuedPuzzles.length - 1 ? 'text-white/10' : 'text-white/50 hover:text-white'}`}
                  >
                    ▼
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-yellow-400 text-xs">⚡ {p.rewardSats}</span>
                    <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded">Queued</span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{p.question}</p>
                  <p className="text-white/50 text-xs truncate">{p.scenario}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleEdit(p)} className="text-blue-400 hover:text-blue-300 text-sm">
                    Edit
                  </button>
                  <button onClick={() => handleToggleActive(p)} className="text-yellow-400 hover:text-yellow-300 text-sm">
                    Deactivate
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-sm">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== USED PUZZLES (read-only, sorted by most recent) ===== */}
      {usedPuzzles.length > 0 && (
        <div>
          <h4 className="text-white font-medium mb-3">
            ✅ Used ({usedPuzzles.length} puzzles)
          </h4>
          <div className="space-y-2">
            {usedPuzzles.map((p) => (
              <div key={p.id} className="bg-white/5 rounded-lg p-3 flex items-start justify-between gap-4 opacity-70">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-white/40 text-xs">
                      Shown {new Date(p.usedAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-yellow-400 text-xs">⚡ {p.rewardSats}</span>
                    {p._count?.attempts > 0 && (
                      <span className="text-white/40 text-xs">
                        {p._count.attempts} attempt{p._count.attempts !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="bg-white/10 text-white/40 text-xs px-2 py-0.5 rounded">Used</span>
                  </div>
                  <p className="text-white text-sm font-medium truncate">{p.question}</p>
                  <p className="text-white/50 text-xs truncate">{p.scenario}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleEdit(p)} className="text-blue-400 hover:text-blue-300 text-sm">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== INACTIVE PUZZLES ===== */}
      {inactivePuzzles.length > 0 && (
        <div>
          <h4 className="text-white/50 font-medium mb-3">
            🚫 Inactive ({inactivePuzzles.length})
          </h4>
          <div className="space-y-2">
            {inactivePuzzles.map((p) => (
              <div key={p.id} className="bg-white/5 rounded-lg p-3 flex items-start justify-between gap-4 opacity-50">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.question}</p>
                  <p className="text-white/50 text-xs truncate">{p.scenario}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleToggleActive(p)} className="text-green-400 hover:text-green-300 text-sm">
                    Reactivate
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-sm">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
