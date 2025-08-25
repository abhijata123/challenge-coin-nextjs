import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { Star, Rotate3D, User, Search, X, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import { UserBadges } from '../components/UserBadges';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { NewCoinBadge } from '../components/NewCoinBadge';
import { MessageNotification } from '../components/MessageNotification';

interface User {
  Username: string;
  'piture link': string | null;
  Status: string | null;
  is_admin: boolean;
  is_founding_member: boolean;
}

interface Coin {
  id: number;
  'Coin Name': string;
  'Coin Image': string;
  'BacksideUrl': string | null;
  'Date Issued': string;
  Featured: boolean;
  Username: string;
  'Mode Of Acquiring': string;
  UserId: string;
  created_at: string;
  'Has Copyright': boolean;
  owner: {
    Username: string;
    'piture link': string | null;
    Status: string | null;
    is_admin: boolean;
    is_founding_member: boolean;
  };
}

interface CoinOwner {
  id: number;
  Username: string;
  'piture link': string | null;
  Status: string | null;
  is_admin: boolean;
  is_founding_member: boolean;
  email: string;
}

export const CoinForum: React.FC = () => {
  const { user } = useAuthStore();
  const { theme, initializeTheme } = useThemeStore();
  const [filteredCoins, setFilteredCoins] = useState<Coin[]>([]);
  const [flippedCoins, setFlippedCoins] = useState<Record<number, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [uniqueUsers, setUniqueUsers] = useState<{ Username: string; 'piture link': string | null; Status: string | null; coinCount: number; is_admin: boolean; is_founding_member: boolean }[]>([]);
  const [showOwnersModal, setShowOwnersModal] = useState(false);
  const [selectedCoinForOwners, setSelectedCoinForOwners] = useState<Coin | null>(null);
  const [uniqueCoinOwners, setUniqueCoinOwners] = useState<Record<string, CoinOwner[]>>({});
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [isCometChatInitialized, setIsCometChatInitialized] = useState(false);
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const notificationSoundRef = useRef<HTMLAudioElement>(null);
  const [notification, setNotification] = useState<{
    sender: { name: string; avatar?: string; uid: string };
    message: string;
  } | null>(null);

  // Fetch coins function for TanStack Query
  const fetchCoinsData = async (): Promise<{ coins: Coin[]; uniqueCoins: Coin[]; uniqueCoinOwners: Record<string, CoinOwner[]> }> => {
    const { data: coinData, error: coinError } = await supabase
      .from('Challenge Coin Table')
      .select(`
        id,
        "Coin Name",
        "Coin Image",
        "BacksideUrl",
        "Date Issued",
        Featured,
        Username,
        "Mode Of Acquiring",
        UserId,
        created_at,
        "Has Copyright"
      `)
      .eq('Public Display', true)
      .order('created_at', { ascending: false });

    if (coinError) throw coinError;

    if (!coinData || coinData.length === 0) {
      return { coins: [], uniqueCoins: [], uniqueCoinOwners: {} };
    }

    const usernames = [...new Set(coinData.map(coin => coin.Username))];

    const { data: userData, error: userError } = await supabase
      .from('User Dps')
      .select('Username, "piture link", Status, is_admin, is_founding_member, email')
      .in('Username', usernames);

    if (userError) throw userError;

    const userMap = new Map(userData?.map(user => [user.Username, user]) || []);

    const coinsWithOwner = coinData.map(coin => ({
      ...coin,
      owner: userMap.get(coin.Username) || {
        Username: coin.Username,
        'piture link': null,
        Status: null,
        is_admin: false,
        is_founding_member: false
      }
    }));

    // Process unique coins and their owners
    const coinsByName = new Map<string, { coin: Coin; owners: CoinOwner[] }>();
    
    coinsWithOwner.forEach(coin => {
      const coinName = coin['Coin Name'];
      const owner: CoinOwner = {
        id: coin.id,
        Username: coin.Username,
        'piture link': coin.owner['piture link'],
        Status: coin.owner.Status,
        is_admin: coin.owner.is_admin,
        is_founding_member: coin.owner.is_founding_member,
        email: coin.UserId
      };

      if (coinsByName.has(coinName)) {
        coinsByName.get(coinName)!.owners.push(owner);
      } else {
        coinsByName.set(coinName, {
          coin: coin,
          owners: [owner]
        });
      }
    });

    const uniqueCoinsArray: Coin[] = [];
    const ownersMap: Record<string, CoinOwner[]> = {};

    coinsByName.forEach(({ coin, owners }, coinName) => {
      uniqueCoinsArray.push(coin);
      ownersMap[coinName] = owners;
    });

    return { coins: coinsWithOwner, uniqueCoins: uniqueCoinsArray, uniqueCoinOwners: ownersMap };
  };

  // Use TanStack Query to fetch and cache coins data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['publicCoins'],
    queryFn: fetchCoinsData,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  const coins = data?.coins || [];
  const uniqueCoins = data?.uniqueCoins || [];
  const loading = isLoading;

  // Initialize theme for the current user
  useEffect(() => {
    if (user) {
      initializeTheme();
    }
  }, [user]);

  // Update uniqueCoinOwners when data changes
  useEffect(() => {
    if (data?.uniqueCoinOwners) {
      setUniqueCoinOwners(data.uniqueCoinOwners);
    }
  }, [data]);

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
          }).then(() => {
            // Add message listener
            (window as any).CometChatWidget.on("onMessageReceived", (message: any) => {
              console.log("CometChatWidget onMessageReceived in CoinForum", message);
              
              // Play notification sound
              if (notificationSoundRef.current) {
                notificationSoundRef.current.volume = 0.5; // Set volume to 50%
                notificationSoundRef.current.play().catch(err => {
                  console.error("Error playing notification sound:", err);
                });
              }
              
              // Show popup notification
              setNotification({
                sender: {
                  name: message.sender.name || message.sender.uid,
                  avatar: message.sender.avatar,
                  uid: message.sender.uid
                },
                message: message.text || "New message"
              });
            });
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
    if (uniqueCoins.length > 0 && searchTerm.trim().length > 0) {
      const uniqueNames = [...new Set(uniqueCoins
        .map(coin => coin['Coin Name'])
        .filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
      )];
      setSuggestions(uniqueNames.slice(0, 5));
      setShowSuggestions(uniqueNames.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchTerm, uniqueCoins]);

  useEffect(() => {
    if (uniqueCoins.length > 0) {
      const filtered = uniqueCoins.filter(coin => {
        const matchesSearch = searchTerm === '' || 
          coin['Coin Name'].toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      });
      
      setFilteredCoins(filtered);

      // Update unique users based on all owners of displayed coins
      const userMap = new Map();
      filtered.forEach(coin => {
        const owners = uniqueCoinOwners[coin['Coin Name']] || [];
        owners.forEach(owner => {
          if (!userMap.has(owner.Username)) {
            userMap.set(owner.Username, {
              Username: owner.Username,
              'piture link': owner['piture link'],
              Status: owner.Status,
              coinCount: 1,
              is_admin: owner.is_admin,
              is_founding_member: owner.is_founding_member
            });
          } else {
            userMap.get(owner.Username).coinCount++;
          }
        });
      });
      setUniqueUsers(Array.from(userMap.values()));
    }
  }, [uniqueCoins, searchTerm, uniqueCoinOwners]);

  const preloadImage = (src: string, coinId: number, isMainImage = true) => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      if (isMainImage) {
        setLoadingImages(prev => ({
          ...prev,
          [coinId]: false
        }));
      }
    };
    img.onerror = () => {
      if (isMainImage) {
        setLoadingImages(prev => ({
          ...prev,
          [coinId]: false
        }));
      }
      console.error(`Failed to load image: ${src}`);
    };
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
  };

  const toggleCoinFlip = (coinId: number) => {
    setFlippedCoins(prev => ({
      ...prev,
      [coinId]: !prev[coinId]
    }));
  };

  const handleCoinClick = (coin: Coin) => {
    setSelectedCoinForOwners(coin);
    setShowOwnersModal(true);
  };

  // Prevent right-click and other ways to save the image
  const preventSave = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-white mb-4">Failed to load coins</div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Owners Modal Component
  const OwnersModal: React.FC = () => {
    if (!showOwnersModal || !selectedCoinForOwners) return null;

    const owners = uniqueCoinOwners[selectedCoinForOwners['Coin Name']] || [];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-[#0d182a] rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">
              {selectedCoinForOwners['Coin Name']} - Owners
            </h2>
            <button
              onClick={() => setShowOwnersModal(false)}
              className="text-gray-400 hover:text-white p-2"
            >
              <X size={24} />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-6 p-4 bg-white/5 rounded-lg">
            <div 
              className="relative w-20 h-20"
              onContextMenu={preventSave}
            >
              <img
                src={selectedCoinForOwners['Coin Image']}
                alt={selectedCoinForOwners['Coin Name']}
                className="w-full h-full object-contain rounded-lg select-none"
                draggable="false"
                style={{
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                {selectedCoinForOwners['Coin Name']}
              </h3>
              <p className="text-gray-400">
                Owned by {owners.length} {owners.length === 1 ? 'collector' : 'collectors'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Collectors</h3>
            {owners.map((owner) => (
              <Link
                key={`${owner.id}-${owner.Username}`}
                href={`/collection/${owner.Username}/coin/${owner.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full overflow-hidden">
                      <img
                        src={owner['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${owner.Username}`}
                        alt={owner.Username}
                        className="w-full h-full object-cover"
                        width="48"
                        height="48"
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      <UserBadges 
                        isAdmin={owner.is_admin} 
                        isFoundingMember={owner.is_founding_member}
                        onSuccess={() => refetch()}
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{owner.Username}</p>
                    {owner.Status && (
                      <p className="text-sm text-gray-400 truncate">{owner.Status}</p>
                    )}
                  </div>
                  <div className="text-blue-400 text-sm">
                    View Coin →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading coins...</div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-[#0d182a] bg-opacity-95"
      style={{
        backgroundImage: `url('${getBackgroundImage(theme)}')`,
        backgroundBlendMode: 'overlay',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Hidden audio element for notification sound */}
      <audio ref={notificationSoundRef} preload="auto">
        <source src="/notification.mp3" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
      
      {notification && (
        <MessageNotification 
          sender={notification.sender}
          message={notification.message}
          onClose={() => setNotification(null)}
          onClick={() => {
            (window as any).CometChatWidget.chatWithUser(notification.sender.uid);
            setNotification(null);
          }}
        />
      )}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-6 mb-8">
          <h1 className="text-3xl font-bold text-white text-center sm:text-left">Coin Forum</h1>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full" ref={suggestionsRef}>
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearch}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search by coin name..."
                className="w-full px-4 py-3 pl-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-lg border border-white/10 overflow-hidden">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {searchTerm && (
            <div className="text-gray-400 text-sm">
              Found {filteredCoins.length} unique {filteredCoins.length === 1 ? 'coin' : 'coins'} for "{searchTerm}"
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCoins.map((coin) => (
                <div
                  key={coin.id}
                  className="bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden cursor-pointer"
                  onClick={() => handleCoinClick(coin)}
                >
                  <div className="relative group">
                    <NewCoinBadge dateAdded={coin.created_at} />
                    {loadingImages[coin.id] ? (
                      <div className="relative aspect-square flex items-center justify-center">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ) : (
                      <div 
                        className="relative aspect-square"
                        onContextMenu={preventSave}
                      >
                        <img
                          src={flippedCoins[coin.id] && coin.BacksideUrl ? coin.BacksideUrl : coin['Coin Image']}
                          alt={coin['Coin Name']}
                          className="absolute inset-0 w-full h-full object-contain p-4 select-none"
                          width="300"
                          height="300"
                          loading="lazy"
                          draggable="false"
                          style={{
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            pointerEvents: 'none'
                          }}
                        />
                        {coin['Has Copyright'] && (
                          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                            Made by {coin.Username}
                          </div>
                        )}
                      </div>
                    )}
                    {coin.Featured && (
                      <div className="absolute top-2 right-2">
                        <Star className="h-6 w-6 text-yellow-500 fill-current" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="text-white text-center p-4">
                        <h3 className="font-bold break-words">{coin['Coin Name']}</h3>
                        <p className="text-sm text-gray-300 mt-2">
                          {new Date(coin['Date Issued']).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-blue-400 mt-2">
                          {uniqueCoinOwners[coin['Coin Name']]?.length || 1} {uniqueCoinOwners[coin['Coin Name']]?.length === 1 ? 'owner' : 'owners'}
                        </p>
                        {coin.BacksideUrl && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleCoinFlip(coin.id);
                            }}
                            className="mt-4 flex items-center gap-2 mx-auto text-blue-400 hover:text-blue-300"
                          >
                            <Rotate3D size={16} />
                            Flip Coin
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCoinClick(coin);
                          }}
                          className="mt-4 flex items-center gap-2 mx-auto text-green-400 hover:text-green-300"
                        >
                          <Users size={16} />
                          View Owners
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {filteredCoins.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
                  <Search className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg">No unique coins found matching your search.</p>
                  <p className="text-sm mt-2">Try adjusting your search terms.</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 sticky top-24">
              <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                <User className="h-5 w-5" />
                Contributors
              </h2>
              <div className="space-y-4">
                {uniqueUsers.map((collector) => (
                  <Link
                    key={collector.Username}
                    href={`/collection/${collector.Username}`}
                    className="block bg-white/5 rounded-lg p-3 sm:p-4 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden flex-shrink-0">
                          <img
                            src={collector['piture link'] ? collector['piture link'] : `https://api.dicebear.com/7.x/initials/svg?seed=${collector.Username}`}
                            alt={collector.Username}
                            className="w-full h-full object-cover"
                            width="40"
                            height="40"
                            loading="lazy"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div className="absolute -bottom-1 -right-1">
                          <UserBadges 
                            isAdmin={collector.is_admin} 
                            isFoundingMember={collector.is_founding_member}
                            size={12}
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate text-sm sm:text-base">{collector.Username}</p>
                        {collector.Status && (
                          <p className="text-xs sm:text-sm text-gray-400 truncate">{collector.Status}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs sm:text-sm text-blue-400 font-medium">{collector.coinCount}</p>
                        <p className="text-xs text-gray-400 hidden sm:block">unique coins</p>
                        <p className="text-xs text-gray-400 sm:hidden">coins</p>
                      </div>
                    </div>
                  </Link>
                ))}

                {uniqueUsers.length === 0 && (
                  <div className="text-center text-gray-400">
                    <p>No contributors found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Owners Modal */}
      <OwnersModal />
    </div>
  );
};