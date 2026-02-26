'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { playersAPI } from '@/lib/api';

interface PointsHistoryEntry {
  id: string;
  points: number;
  reason: string;
  date: string;
}

interface RecentResult {
  eventId: string;
  eventName: string;
  eventDate: string;
  venue: string;
  position: number;
  pointsEarned: number;
  knockouts: number;
}

interface SeasonStanding {
  seasonId: string;
  seasonName: string;
  isActive?: boolean;
  totalPoints: number;
  eventsPlayed: number;
  wins: number;
  topThrees: number;
  knockouts: number;
  rank: number | null;
}

interface PlayerProfile {
  id: string;
  name: string;
  avatar: string | null;
  profileImage: string | null;
  bio: string | null;
  telegramUsername: string | null;
  nostrPubkey: string | null;
  socialLinks: Record<string, string> | null;
  memberSince: string;
  currentSeasonStanding: {
    seasonName: string;
    totalPoints: number;
    eventsPlayed: number;
    wins: number;
    topThrees: number;
    knockouts: number;
    rank: number | null;
    registrationPoints?: number;
  } | null;
  recentResults: RecentResult[];
  pointsHistory: PointsHistoryEntry[];
  allSeasons: SeasonStanding[];
  upcomingEvents: {
    id: string;
    name: string;
    dateTime: string;
    venue: string;
  }[];
}

const SOCIAL_ICONS: Record<string, string> = {
  twitter: '𝕏',
  instagram: '📷',
  facebook: '📘',
  website: '🌐',
  nostr: '🟣',
  linkedin: '💼',
};

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = params.id as string;
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, [playerId]);

  const loadProfile = async () => {
    try {
      const data = await playersAPI.getProfile(playerId);
      setProfile(data.player);
    } catch (err: any) {
      setError(err.message || 'Failed to load player profile');
    } finally {
      setLoading(false);
    }
  };

  const getProfileImageUrl = () => {
    if (profile?.profileImage) return profile.profileImage;
    if (profile?.avatar) return profile.avatar;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <MobileNav />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
            <p className="text-blue-100 mt-4">Loading player profile...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen">
        <MobileNav />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-red-400 text-lg">{error || 'Player not found'}</p>
            <Link href="/leaderboard" className="text-blue-400 hover:text-blue-300 mt-4 inline-block">
              ← Back to Leaderboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const imageUrl = getProfileImageUrl();
  const currentSeason = profile.currentSeasonStanding;

  return (
    <div className="min-h-screen">
      <MobileNav />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link href="/leaderboard" className="text-blue-400 hover:text-blue-300 text-sm mb-6 inline-block">
          ← Back to Leaderboard
        </Link>

        {/* Profile Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={profile.name}
                  className="w-24 h-24 rounded-full object-cover border-2 border-blue-500"
                />
              ) : (
                <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold border-2 border-blue-500">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Name & Info */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl font-bold text-white">{profile.name}</h1>
              <p className="text-blue-200 text-sm mt-1">
                Member since {new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              {profile.bio && (
                <p className="text-blue-100 mt-3">{profile.bio}</p>
              )}

              {/* Telegram */}
              {profile.telegramUsername && (
                <p className="text-blue-300/70 text-sm mt-2 flex items-center gap-1">
                  <span>✈️</span>
                  <a
                    href={`https://t.me/${profile.telegramUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-200 transition"
                  >
                    @{profile.telegramUsername}
                  </a>
                </p>
              )}

              {/* Nostr Public Key */}
              {profile.nostrPubkey && (
                <p className="text-purple-300/70 text-sm mt-2 flex items-center gap-2 flex-wrap">
                  <span>🟣</span>
                  <span className="font-mono text-xs text-purple-200/70 truncate max-w-[220px]">{profile.nostrPubkey}</span>
                </p>
              )}

              {/* Social Links */}
              {profile.socialLinks && Object.keys(profile.socialLinks).length > 0 && (
                <div className="flex flex-wrap gap-3 mt-3 justify-center sm:justify-start">
                  {Object.entries(profile.socialLinks).map(([platform, url]) => {
                    if (!url) return null;
                    const href = url.startsWith('http') ? url : `https://${url}`;
                    return (
                      <a
                        key={platform}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm bg-white/10 hover:bg-white/20 text-blue-200 hover:text-white px-3 py-1.5 rounded-lg transition"
                      >
                        <span>{SOCIAL_ICONS[platform] || '🔗'}</span>
                        <span className="capitalize">{platform}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Current Season Rank */}
            {currentSeason && currentSeason.rank && (
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-300">
                  #{currentSeason.rank}
                </div>
                <p className="text-blue-200 text-xs mt-1">Current Rank</p>
              </div>
            )}
          </div>
        </div>

        {/* Current Season Stats */}
        {currentSeason && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📊 {currentSeason.seasonName}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-300">{currentSeason.totalPoints}</p>
                <p className="text-xs text-blue-200">Points</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-white">{currentSeason.eventsPlayed}</p>
                <p className="text-xs text-blue-200">Events</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-400">{currentSeason.wins}</p>
                <p className="text-xs text-blue-200">Wins</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-orange-400">{currentSeason.topThrees}</p>
                <p className="text-xs text-blue-200">Top 3</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-400">{currentSeason.knockouts}</p>
                <p className="text-xs text-blue-200">KOs</p>
              </div>
            </div>
          </div>
        )}

        {/* Points Breakdown */}
        {((profile.pointsHistory && profile.pointsHistory.length > 0) || (currentSeason?.registrationPoints && currentSeason.registrationPoints > 0)) && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">⭐ Points Breakdown</h2>
            <div className="space-y-2">
              {/* Registration points (not tracked in PointsHistory) */}
              {currentSeason?.registrationPoints != null && currentSeason.registrationPoints > 0 && (
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium">Event registration bonuses</p>
                    <p className="text-blue-200/60 text-xs mt-0.5">Early bird & signup points</p>
                  </div>
                  <span className="text-sm font-bold ml-3 flex-shrink-0 text-green-400">
                    +{currentSeason.registrationPoints} pts
                  </span>
                </div>
              )}
              {/* PointsHistory entries (check-in, placement, manual, etc.) */}
              {profile.pointsHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{entry.reason}</p>
                    {entry.date && (
                      <p className="text-blue-200/60 text-xs mt-0.5">
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <span className={`text-sm font-bold ml-3 flex-shrink-0 ${
                    entry.points > 0 ? 'text-green-400' : entry.points < 0 ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {entry.points > 0 ? '+' : ''}{entry.points} pts
                  </span>
                </div>
              ))}
            </div>
            {/* Season Total (computed from PointsHistory + registration) */}
            {currentSeason && (
              <div className="mt-3 pt-3 border-t border-blue-600/30 flex items-center justify-between">
                <p className="text-blue-200 text-sm font-medium">Season Total</p>
                <span className="text-blue-300 font-bold text-lg">
                  {currentSeason.totalPoints} pts
                </span>
              </div>
            )}
          </div>
        )}

        {/* Recent Results */}
        {profile.recentResults && profile.recentResults.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">🏆 Recent Results</h2>
            <div className="space-y-2">
              {profile.recentResults.map((result) => (
                <Link
                  key={result.eventId}
                  href={`/events/${result.eventId}`}
                  className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">{result.eventName}</p>
                    <p className="text-blue-200/60 text-xs mt-0.5">
                      {result.venue} • {new Date(result.eventDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                      result.position === 1 ? 'bg-yellow-600/30 text-yellow-300' :
                      result.position <= 3 ? 'bg-orange-600/30 text-orange-300' :
                      'bg-blue-600/30 text-blue-300'
                    }`}>
                      {getOrdinal(result.position)}
                    </span>
                    {result.knockouts > 0 && (
                      <span className="text-xs text-red-400" title="Knockouts">
                        💥{result.knockouts}
                      </span>
                    )}
                    <span className="text-green-400 text-sm font-bold">
                      +{result.pointsEarned}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Seasons History */}
        {profile.allSeasons && profile.allSeasons.length > 1 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6">
            <h2 className="text-xl font-bold text-white mb-4">📅 Season History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-blue-200 border-b border-blue-600/30">
                    <th className="text-left py-2 px-3">Season</th>
                    <th className="text-center py-2 px-3">Rank</th>
                    <th className="text-center py-2 px-3">Points</th>
                    <th className="text-center py-2 px-3">Events</th>
                    <th className="text-center py-2 px-3">Wins</th>
                    <th className="text-center py-2 px-3">Top 3</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.allSeasons.map((season) => (
                    <tr key={season.seasonId} className="border-b border-blue-600/10 hover:bg-white/5">
                      <td className="py-2 px-3 text-white">
                        {season.seasonName}
                        {season.isActive && (
                          <span className="ml-2 text-xs text-green-400">(current)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center text-blue-300 font-bold">
                        {season.rank ? `#${season.rank}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-center text-blue-300">{season.totalPoints}</td>
                      <td className="py-2 px-3 text-center text-white">{season.eventsPlayed}</td>
                      <td className="py-2 px-3 text-center text-yellow-400">{season.wins}</td>
                      <td className="py-2 px-3 text-center text-white">{season.topThrees}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
