import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, Clock, Medal } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';

interface TopCollector {
  Username: string;
  coin_count: number;
  profile_image: string | null;
  Status: string | null;
}

interface NewUser {
  Username: string;
  joined_date: string;
  profile_image: string | null;
  Status: string | null;
}

export const Leaderboard: React.FC = () => {
  const { theme } = useThemeStore();
  const [topCollectors, setTopCollectors] = useState<TopCollector[]>([]);
  const [newUsers, setNewUsers] = useState<NewUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboardData();
  }, []);

  const fetchLeaderboardData = async () => {
    try {
      // Fetch top collectors
      const { data: collectorsData, error: collectorsError } = await supabase
        .from('User Dps')
        .select('Username, "Public Coin Count", "piture link", Status')
        .order('Public Coin Count', { ascending: false })
        .limit(10);

      if (collectorsError) throw collectorsError;

      const activeCollectors = (collectorsData || []).filter(c => c["Public Coin Count"] > 0);
      const formattedCollectors = activeCollectors.map((c) => ({
        Username: c.Username,
        coin_count: c["Public Coin Count"],
        profile_image: c["piture link"],
        Status: c.Status,
      }));
      setTopCollectors(formattedCollectors);

      // Fetch newest users
      const { data: usersData, error: usersError } = await supabase
        .from('User Dps')
        .select('Username, created_at, "piture link", Status')
        .order('created_at', { ascending: false })
        .limit(10);

      if (usersError) throw usersError;

      const formattedUsers = (usersData || []).map((u) => ({
        Username: u.Username,
        joined_date: u.created_at || new Date().toISOString(), // Provide current date as fallback
        profile_image: u["piture link"],
        Status: u.Status,
      }));
      setNewUsers(formattedUsers);
    } catch (error) {
      console.error('Error fetching leaderboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMedalColor = (index: number): string => {
    switch (index) {
      case 0: return 'text-yellow-400'; // Gold
      case 1: return 'text-gray-400';   // Silver
      case 2: return 'text-amber-600';  // Bronze
      default: return 'text-blue-400';  // Other positions
    }
  };

  // Helper function to format date safely
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      // Check if date is valid (not 1970-01-01)
      if (date.getFullYear() < 2000) {
        return 'Recently joined';
      }
      return date.toLocaleDateString();
    } catch (e) {
      return 'Recently joined';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading leaderboard...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#0d182a] bg-opacity-95 py-8"
      style={{
        backgroundImage: `url('${getBackgroundImage(theme)}')`,
        backgroundBlendMode: 'overlay',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-white mb-8 flex items-center gap-2">
          <Trophy className="h-8 w-8 text-yellow-400" />
          Leaderboard
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Collectors */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Medal className="h-6 w-6 text-yellow-400" />
              Top Public Collections
            </h2>
            <div className="space-y-4">
              {topCollectors.length > 0 ? (
                topCollectors.map((collector, index) => (
                  <Link
                    key={collector.Username}
                    href={`/collection/${collector.Username}`}
                    className="block bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-12 h-12 rounded-full overflow-hidden">
                          <img
                            src={collector.profile_image || `https://api.dicebear.com/7.x/initials/svg?seed=${collector.Username}`}
                            alt={collector.Username}
                            className="w-full h-full object-cover"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div className={`absolute -top-2 -right-2 ${getMedalColor(index)}`}>
                          {index < 3 ? (
                            <Medal className="h-6 w-6" />
                          ) : (
                            <span className="text-sm font-medium">
                              #{index + 1}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{collector.Username}</h3>
                        {collector.Status && (
                          <p className="text-sm text-gray-400 truncate">{collector.Status}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-yellow-400">
                          {collector.coin_count}
                        </p>
                        <p className="text-sm text-gray-400">public coins</p>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center text-gray-400 py-8">
                  <p>No public collections available</p>
                </div>
              )}
            </div>
          </div>

          {/* New Users */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Clock className="h-6 w-6 text-blue-400" />
              New Members
            </h2>
            <div className="space-y-4">
              {newUsers.map((user) => (
                <Link
                  key={user.Username}
                  href={`/collection/${user.Username}`}
                  className="block bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <img
                        src={user.profile_image || `https://api.dicebear.com/7.x/initials/svg?seed=${user.Username}`}
                        alt={user.Username}
                        className="w-full h-full object-cover"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">{user.Username}</h3>
                      {user.Status && (
                        <p className="text-sm text-gray-400 truncate">{user.Status}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">
                        {formatDate(user.joined_date)}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}

              {newUsers.length === 0 && (
                <div className="text-center text-gray-400">
                  <p>No new members yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};