'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { seasonsAPI } from '@/lib/api';

interface Standing {
  id: string;
  totalPoints: number;
  eventsPlayed: number;
  wins: number;
  topThrees: number;
  knockouts: number;
  rank?: number;
  user: {
    id: string;
    name: string;
    avatar?: string;
    isGuest?: boolean;
  };
}

interface Season {
  id: string;
  name: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
  _count: {
    events: number;
    standings: number;
  };
}

export default function LeaderboardPage() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeason) {
      loadStandings();
    }
  }, [selectedSeason]);

  const loadSeasons = async () => {
    try {
      const data = await seasonsAPI.getAll();
      setSeasons(data);
      
      // If no seasons exist, stop loading
      if (data.length === 0) {
        setLoading(false);
        return;
      }
      
      // Select active season by default
      const activeSeason = data.find((s: Season) => s.isActive);
      if (activeSeason) {
        setSelectedSeason(activeSeason.id);
        setCurrentSeason(activeSeason);
      } else {
        setSelectedSeason(data[0].id);
        setCurrentSeason(data[0]);
      }
    } catch (err) {
      console.error('Failed to load seasons:', err);
      setError('Failed to load seasons');
      setLoading(false);
    }
  };

  const loadStandings = async () => {
    setLoading(true);
    try {
      const data = await seasonsAPI.getStandings(selectedSeason, 100);
      setStandings(data);
      
      // Update current season info
      const season = seasons.find(s => s.id === selectedSeason);
      if (season) {
        setCurrentSeason(season);
      }
    } catch (err) {
      setError('Failed to load standings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getRankDisplay = (index: number) => {
    if (index === 0) return { emoji: '🥇', bg: 'bg-yellow-500/20 border-yellow-500/50' };
    if (index === 1) return { emoji: '🥈', bg: 'bg-gray-400/20 border-gray-400/50' };
    if (index === 2) return { emoji: '🥉', bg: 'bg-orange-600/20 border-orange-600/50' };
    return { emoji: `#${index + 1}`, bg: 'bg-white/5 border-transparent' };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-black">
      <MobileNav currentPage="leaderboard" />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">🏆 Leaderboard</h1>
          <p className="text-green-200">Season standings and player rankings</p>
        </div>

        {/* Season Selector */}
        <div className="mb-6 flex flex-wrap justify-center gap-4">
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            className="bg-white/10 text-white border border-green-600/50 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.id} className="text-black">
                {season.name} {season.isActive && '(Current)'}
              </option>
            ))}
          </select>
        </div>

        {/* Season Info */}
        {currentSeason && (
          <div className="mb-6 bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 p-4">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{currentSeason.name}</h2>
                <p className="text-green-200 text-sm">
                  {new Date(currentSeason.startDate).toLocaleDateString()} - {new Date(currentSeason.endDate).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-6 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-400">{currentSeason._count.events}</p>
                  <p className="text-xs text-green-200">Events</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">{currentSeason._count.standings}</p>
                  <p className="text-xs text-green-200">Players</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Standings Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto"></div>
            <p className="text-green-200 mt-4">Loading standings...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">{error}</p>
          </div>
        ) : standings.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-xl">
            <p className="text-green-200 text-lg">No standings yet</p>
            <p className="text-green-300/60 mt-2">Play in events to appear on the leaderboard!</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white/10 backdrop-blur-sm rounded-xl border border-green-600/30 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-black/20 text-green-300 text-sm font-medium">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Player</div>
                <div className="col-span-2 text-center">Points</div>
                <div className="col-span-1 text-center">Events</div>
                <div className="col-span-1 text-center">Wins</div>
                <div className="col-span-1 text-center">Top 3</div>
                <div className="col-span-2 text-center">Knockouts</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-green-600/20">
                {standings.map((standing, index) => {
                  const rankInfo = getRankDisplay(index);
                  return (
                    <div
                      key={standing.id}
                      className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-white/5 transition ${rankInfo.bg} border-l-4`}
                    >
                      {/* Rank */}
                      <div className="col-span-1">
                        <span className="text-xl font-bold text-white">
                          {index < 3 ? rankInfo.emoji : `#${index + 1}`}
                        </span>
                      </div>

                      {/* Player */}
                      <div className="col-span-4 flex items-center gap-3">
                        <div className={`w-10 h-10 ${standing.user.isGuest ? 'bg-gray-500' : 'bg-green-600'} rounded-full flex items-center justify-center text-white font-bold`}>
                          {standing.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-white font-medium truncate">{standing.user.name}</span>
                          {standing.user.isGuest && (
                            <span className="text-xs bg-gray-600/50 text-gray-300 px-1.5 py-0.5 rounded flex-shrink-0">Guest</span>
                          )}
                        </div>
                      </div>

                      {/* Points */}
                      <div className="col-span-2 text-center">
                        <span className="text-xl font-bold text-green-400">{standing.totalPoints}</span>
                        <span className="text-green-300 text-sm ml-1">pts</span>
                      </div>

                      {/* Events */}
                      <div className="col-span-1 text-center text-white">
                        {standing.eventsPlayed}
                      </div>

                      {/* Wins */}
                      <div className="col-span-1 text-center">
                        {standing.wins > 0 ? (
                          <span className="text-yellow-400 font-bold">{standing.wins}</span>
                        ) : (
                          <span className="text-gray-500">0</span>
                        )}
                      </div>

                      {/* Top 3 */}
                      <div className="col-span-1 text-center text-white">
                        {standing.topThrees}
                      </div>

                      {/* Knockouts */}
                      <div className="col-span-2 text-center text-white">
                        {standing.knockouts}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {standings.map((standing, index) => {
                const rankInfo = getRankDisplay(index);
                return (
                  <div
                    key={standing.id}
                    className={`p-4 rounded-xl ${rankInfo.bg} border`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold">
                          {index < 3 ? rankInfo.emoji : `#${index + 1}`}
                        </span>
                        <div className={`w-10 h-10 ${standing.user.isGuest ? 'bg-gray-500' : 'bg-green-600'} rounded-full flex items-center justify-center text-white font-bold`}>
                          {standing.user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-medium">{standing.user.name}</span>
                          {standing.user.isGuest && (
                            <span className="text-xs bg-gray-600/50 text-gray-300 px-1.5 py-0.5 rounded">Guest</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-400">{standing.totalPoints}</p>
                        <p className="text-xs text-green-300">points</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-sm">
                      <div>
                        <p className="text-white font-medium">{standing.eventsPlayed}</p>
                        <p className="text-green-300/60 text-xs">Events</p>
                      </div>
                      <div>
                        <p className="text-yellow-400 font-medium">{standing.wins}</p>
                        <p className="text-green-300/60 text-xs">{standing.wins === 1 ? 'Win' : 'Wins'}</p>
                      </div>
                      <div>
                        <p className="text-white font-medium">{standing.topThrees}</p>
                        <p className="text-green-300/60 text-xs">Top 3</p>
                      </div>
                      <div>
                        <p className="text-white font-medium">{standing.knockouts}</p>
                        <p className="text-green-300/60 text-xs">KOs</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
