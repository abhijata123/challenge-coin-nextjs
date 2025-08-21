import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import { UserBadges } from '../components/UserBadges';
import { useAuthStore } from '../store/authStore';

interface UserProfile {
  Username: string;
  Bio: string;
  'piture link': string;
  Status: string;
  'Public Coin Count': number;
  is_admin: boolean;
  is_founding_member: boolean;
}

export const Search: React.FC = () => {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [isCometChatInitialized, setIsCometChatInitialized] = useState(false);

  useEffect(() => {
    if (user && !isCometChatInitialized) {
      let retryCount = 0;
      const maxRetries = 3;
      const retryInterval = 1000;

      const initChat = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const response = await fetch(`https://27191081cbac1c5c.api-us.cometchat.io/v3/users/${user.id}`, {
            method: 'GET',
            headers: {
              'apikey': '8beed8636a0f5e5496294ba8a66fb0826e912203',
              'Content-Type': 'application/json'
            }
          });

          if (!response.ok) {
            throw new Error('CometChat user not found');
          }

          await (window as any).CometChatWidget.init({
            "appID": "27191081cbac1c5c",
            "appRegion": "us",
            "authKey": "9060f5983cf2e4050738658b003b5b60573589b9"
          });

          await (window as any).CometChatWidget.login({
            "uid": user.id
          });

          await (window as any).CometChatWidget.launch({
            "widgetID": "15b02a26-ed76-4990-86b8-2868c0af2815",
            "docked": "true",
            "alignment": "left",
            "roundedCorners": "true",
            "height": "450px",
            "width": "400px",
            "defaultID": 'cometchat-uid-1',
            "defaultType": 'user'
          });

          setIsCometChatInitialized(true);
        } catch (error) {
          console.error("CometChat initialization error:", error);
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(initChat, retryInterval);
          }
        }
      };

      initChat();
    }
  }, [user, isCometChatInitialized]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchInitialUsers();
  }, []);

  const fetchInitialUsers = async () => {
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('User Dps')
        .select('Username, Bio, "piture link", Status, "Public Coin Count", is_admin, is_founding_member')
        .order('Username')
        .limit(10);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching initial users:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchTerm.trim().length < 1) {
        setSuggestions([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('User Dps')
          .select('Username, Bio, "piture link", Status, "Public Coin Count", is_admin, is_founding_member')
          .ilike('Username', `%${searchTerm}%`)
          .order('Username')
          .limit(5);

        if (error) throw error;
        setSuggestions(data || []);
      } catch (error) {
        console.error('Suggestions error:', error);
        setSuggestions([]);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      fetchInitialUsers();
      return;
    }

    setLoading(true);
    setShowSuggestions(false);
    try {
      const { data, error } = await supabase
        .from('User Dps')
        .select('Username, Bio, "piture link", Status, "Public Coin Count", is_admin, is_founding_member')
        .ilike('Username', `%${searchTerm}%`)
        .order('Username');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (username: string) => {
    window.open(`/collection/${username}`, '_blank');
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading users...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#0d182a] bg-opacity-95 py-8 px-4 sm:px-6 lg:px-8"
      style={{
        backgroundImage: `url('${getBackgroundImage(theme)}')`,
        backgroundBlendMode: 'overlay',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Search Users</h1>

        <div className="relative mb-8" ref={suggestionsRef}>
          <form onSubmit={handleSearch}>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search by username..."
                className="w-full px-4 py-3 pl-12 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <SearchIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            </div>
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/10 overflow-hidden">
              {suggestions.map((user) => (
                <button
                  key={user.Username}
                  onClick={() => handleSuggestionClick(user.Username)}
                  className="w-full px-4 py-3 hover:bg-white/10 transition-colors flex items-center gap-3"
                >
                  <div className="relative">
                    <img
                      src={user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${user.Username}`}
                      alt={user.Username}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      <UserBadges 
                        isAdmin={user.is_admin} 
                        isFoundingMember={user.is_founding_member}
                        size={12}
                      />
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white">{user.Username}</p>
                    {user.Status && (
                      <p className="text-sm text-gray-400 truncate">{user.Status}</p>
                    )}
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm text-blue-400">{user['Public Coin Count']} public coins</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center text-gray-400">
            Searching...
          </div>
        ) : users.length > 0 ? (
          <div className="space-y-4">
            {users.map((user) => (
              <button
                key={user.Username}
                onClick={() => handleSuggestionClick(user.Username)}
                className="w-full bg-white/5 backdrop-blur-sm rounded-lg p-4 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <img
                      src={user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${user.Username}`}
                      alt={user.Username}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="absolute -bottom-1 -right-1">
                      <UserBadges 
                        isAdmin={user.is_admin} 
                        isFoundingMember={user.is_founding_member}
                        size={14}
                      />
                    </div>
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-medium">{user.Username}</h3>
                    {user.Status && (
                      <p className="text-sm text-gray-400">{user.Status}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-400">{user['Public Coin Count']}</p>
                    <p className="text-sm text-gray-400">public coins</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400">
            No users found
          </div>
        )}
      </div>
    </div>
  );
};