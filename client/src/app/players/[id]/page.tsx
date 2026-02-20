'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import MobileNav from '@/components/MobileNav';
import { playersAPI } from '@/lib/api';

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
  currentSeason: {
    seasonId: string;
    seasonName: string;
    totalPoints: number;
    eventsPlayed: number;
    wins: number;
    topThrees: number;
    knockouts: number;
    rank: number | null;
  } | null;
  recentEvents: {
    eventId: string;
    eventName: string;
    eventDate: string;
    venueName: string;
    status: string;
  }[];
  allSeasons: {
    seasonId: string;
    seasonName: string;
    totalPoints: number;
    eventsPlayed: number;
    wins: number;
    topThrees: number;
    knockouts: number;
    rank: number | null;
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
            {profile.currentSeason && profile.currentSeason.rank && (
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-300">
                  #{profile.currentSeason.rank}
                </div>
                <p className="text-blue-200 text-xs mt-1">Current Rank</p>
              </div>
            )}
          </div>
        </div>

        {/* Current Season Stats */}
        {profile.currentSeason && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              📊 {profile.currentSeason.seasonName}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-blue-300">{profile.currentSeason.totalPoints}</p>
                <p className="text-xs text-blue-200">Points</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-white">{profile.currentSeason.eventsPlayed}</p>
                <p className="text-xs text-blue-200">Events</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-yellow-400">{profile.currentSeason.wins}</p>
                <p className="text-xs text-blue-200">Wins</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-orange-400">{profile.currentSeason.topThrees}</p>
                <p className="text-xs text-blue-200">Top 3</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-400">{profile.currentSeason.knockouts}</p>
                <p className="text-xs text-blue-200">KOs</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Events */}
        {profile.recentEvents && profile.recentEvents.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">📅 Recent Events</h2>
            <div className="space-y-2">
              {profile.recentEvents.map((event) => (
                <Link
                  key={event.eventId}
                  href={`/events/${event.eventId}`}
                  className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition"
                >
                  <div>
                    <p className="text-white font-medium">{event.eventName}</p>
                    <p className="text-blue-200 text-sm">
                      {event.venueName} • {new Date(event.eventDate).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    event.status === 'CHECKED_IN' ? 'bg-green-600/30 text-green-300' :
                    event.status === 'REGISTERED' ? 'bg-blue-600/30 text-blue-300' :
                    event.status === 'NO_SHOW' ? 'bg-red-600/30 text-red-300' :
                    'bg-gray-600/30 text-gray-300'
                  }`}>
                    {event.status === 'CHECKED_IN' ? 'Attended' :
                     event.status === 'REGISTERED' ? 'Registered' :
                     event.status === 'NO_SHOW' ? 'No Show' :
                     event.status}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All Seasons History */}
        {profile.allSeasons && profile.allSeasons.length > 1 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-xl border border-blue-600/30 p-6">
            <h2 className="text-xl font-bold text-white mb-4">🏆 Season History</h2>
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
                      <td className="py-2 px-3 text-white">{season.seasonName}</td>
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
