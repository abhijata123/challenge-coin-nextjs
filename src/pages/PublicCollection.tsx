import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Star, Rotate3D, MapPin, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import { useInView } from 'react-intersection-observer';
import { FollowButton } from '../components/FollowButton';
import { AdminActions } from '../components/AdminActions';
import { UserBadges } from '../components/UserBadges';
import { FoundingMemberButton } from '../components/FoundingMemberButton';
import { Helmet } from 'react-helmet';
import { useAuthStore } from '../store/authStore';
import { NewCoinBadge } from '../components/NewCoinBadge';
import { CoinSkeleton } from '../components/CoinSkeleton';
import toast from 'react-hot-toast';
import { MessageNotification } from '../components/MessageNotification';

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
  Priority: number;
}

interface UserProfile {
  id: string;
  Username: string;
  Bio: string;
  'piture link': string;
  Status: string;
  Location: string;
  Theme: string;
  auth_id: string;
  is_admin: boolean;
  is_founding_member: boolean;
  email: string;
}

const COINS_PER_PAGE = 12;

export const PublicCollection: React.FC = () => {
  const { username } = useParams();
  const { user } = useAuthStore();
  const { theme, initializeTheme } = useThemeStore();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [flippedCoins, setFlippedCoins] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCoins, setTotalCoins] = useState(0);
  const [isCometChatInitialized, setIsCometChatInitialized] = useState(false);
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});
  const notificationSoundRef = useRef<HTMLAudioElement>(null);
  const [notification, setNotification] = useState<{
    sender: { name: string; avatar?: string; uid: string };
    message: string;
  } | null>(null);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px 0px',
  });

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
            "defaultID": profile?.auth_id || 'cometchat-uid-1',
            "defaultType": 'user'
          }).then(() => {
            // Add message listener
            (window as any).CometChatWidget.on("onMessageReceived", (message: any) => {
              console.log("CometChatWidget onMessageReceived in PublicCollection", message);
              
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
  }, [user, isCometChatInitialized, profile]);

  useEffect(() => {
    if (username) {
      fetchUserProfile();
    }
  }, [username]);

  // Fixed: Added loadingMore and hasMore to dependencies
  const loadMoreCoins = useCallback(async () => {
    if (!profile?.Username || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const start = coins.length;
      const end = start + COINS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from('Challenge Coin Table')
        .select('*, created_at, "Has Copyright"')
        .eq('Username', profile.Username)
        .eq('Public Display', true)
        .order('Priority', { ascending: true })
        .range(start, end);

      if (error) throw error;

      // Initialize loading state for new coins
      const newLoadingState = { ...loadingImages };
      (data || []).forEach(coin => {
        newLoadingState[coin.id] = true;
        preloadImage(coin['Coin Image'], coin.id);
        if (coin.BacksideUrl) {
          preloadImage(coin.BacksideUrl, coin.id, false);
        }
      });
      setLoadingImages(newLoadingState);

      setCoins([...coins, ...(data || [])]);
      setHasMore(data ? data.length === COINS_PER_PAGE : false);
    } catch (error) {
      console.error('Error loading more coins:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [profile?.Username, loadingMore, hasMore, coins.length, loadingImages]);

  useEffect(() => {
    if (inView && !loadingMore && hasMore) {
      loadMoreCoins();
    }
  }, [inView, loadMoreCoins]);

  useEffect(() => {
    // If profile is loaded and CometChat is initialized, update the chat with the profile user
    if (profile?.auth_id && isCometChatInitialized && user) {
      try {
        (window as any).CometChatWidget.chatWithUser(profile.auth_id);
      } catch (error) {
        console.error("Error starting chat with user:", error);
      }
    }
  }, [profile, isCometChatInitialized]);

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

  const fetchUserProfile = async () => {
    if (!username) return;
    
    try {
      const { data, error } = await supabase
        .from('User Dps')
        .select('id, Username, Bio, "piture link", Status, Location, Theme, auth_id, is_admin, is_founding_member, email')
        .eq('Username', username)
        .single();

      if (error) throw error;
      if (!data) {
        setLoading(false);
        return;
      }

      setProfile(data);
      // Initialize theme with the profile owner's email, not the current user
      initializeTheme(data.email);
      fetchTotalCoins(data.Username);
      fetchInitialCoins(data.Username);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
    }
  };

  const fetchTotalCoins = async (username: string) => {
    try {
      const { count, error } = await supabase
        .from('Challenge Coin Table')
        .select('id', { count: 'exact' })
        .eq('Username', username)
        .eq('Public Display', true);

      if (error) throw error;
      setTotalCoins(count || 0);
    } catch (error) {
      console.error('Error fetching total coins:', error);
    }
  };

  const fetchInitialCoins = async (username: string) => {
    try {
      const { data, error } = await supabase
        .from('Challenge Coin Table')
        .select('*, created_at, "Has Copyright"')
        .eq('Username', username)
        .eq('Public Display', true)
        .order('Priority', { ascending: true })
        .range(0, COINS_PER_PAGE - 1);

      if (error) throw error;

      setCoins(data || []);
      
      // Initialize loading state for each coin
      const newLoadingState: Record<number, boolean> = {};
      (data || []).forEach(coin => {
        newLoadingState[coin.id] = true;
        preloadImage(coin['Coin Image'], coin.id);
        if (coin.BacksideUrl) {
          preloadImage(coin.BacksideUrl, coin.id, false);
        }
      });
      setLoadingImages(newLoadingState);
      
      setHasMore(data ? data.length === COINS_PER_PAGE : false);
    } catch (error) {
      console.error('Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleCoinFlip = (coinId: number) => {
    setFlippedCoins(prev => ({
      ...prev,
      [coinId]: !prev[coinId]
    }));
  };

  // Prevent right-click and other ways to save the image
  const preventSave = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading collection...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Collection not found</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${profile.Username}'s Challenge Coin Collection | Rare & Unique Coins`}</title>
        <meta name="description" content={`Explore ${profile.Username}'s collection of rare and unique challenge coins. Discover the stories behind each piece.`} />
        
        <meta property="og:title" content={`${profile.Username}'s Challenge Coin Collection | Rare & Unique Coins`} />
        <meta property="og:description" content={`Explore ${profile.Username}'s collection of rare and unique challenge coins. Discover the stories behind each piece.`} />
        <meta property="og:image" content={profile['piture link'] || `https://api.dicebear.com/7.x/shapes/svg?seed=${profile.Username}`} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://coin.braav.co/collection/${profile.Username}`} />
        <meta property="og:site_name" content="Braav Challenge Coins" />
        
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${profile.Username}'s Challenge Coin Collection | Rare & Unique Coins`} />
        <meta name="twitter:description" content={`Explore ${profile.Username}'s collection of rare and unique challenge coins. Discover the stories behind each piece.`} />
        <meta name="twitter:image" content={profile['piture link'] || `https://api.dicebear.com/7.x/shapes/svg?seed=${profile.Username}`} />
      </Helmet>

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
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 sm:p-8 mb-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden flex-shrink-0">
                  <img
                    src={profile?.['piture link'] || `https://api.dicebear.com/7.x/shapes/svg?seed=${profile?.Username}`}
                    alt="Profile"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                {profile && (
                  <div className="absolute -bottom-2 -right-2">
                    <UserBadges 
                      isAdmin={profile.is_admin} 
                      isFoundingMember={profile.is_founding_member}
                      size={20}
                    />
                  </div>
                )}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold text-white break-words text-center sm:text-left w-full">
                    {profile?.Username}'s Collection
                  </h1>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    {profile && (
                      <>
                        <FollowButton userId={profile.id} username={profile.Username} />
                        <AdminActions 
                          userEmail={user?.email}
                          onSuccess={() => window.location.href = '/'}
                        />
                        <FoundingMemberButton
                          userEmail={profile.email}
                          isFoundingMember={profile.is_founding_member}
                          onSuccess={fetchUserProfile}
                        />
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-300 break-words">{profile.Bio || 'No bio available'}</p>
                  {profile.Status && (
                    <div className="flex items-center gap-2 text-gray-300 justify-center sm:justify-start">
                      <User size={16} className="text-blue-400" />
                      <span>{profile.Status}</span>
                    </div>
                  )}
                  {profile.Location && (
                    <div className="flex items-center gap-2 text-gray-300 justify-center sm:justify-start">
                      <MapPin size={16} className="text-red-400" />
                      <span>{profile.Location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {coins.map((coin) => (
              <div
                key={coin.id}
                className={`bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden ${
                  coin.Featured ? 'ring-2 ring-yellow-500' : ''
                }`}
              >
                <Link
                  href={`/collection/${coin.Username}/coin/${coin.id}`}
                  className="relative group block"
                >
                  <NewCoinBadge dateAdded={coin.created_at} />
                  {loadingImages[coin.id] ? (
                    <div className="relative w-[200px] h-[200px] mx-auto flex items-center justify-center">
                      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div 
                      className="relative w-[200px] h-[200px] mx-auto"
                      onContextMenu={preventSave} // Prevent right-click
                    >
                      <img
                        src={flippedCoins[coin.id] && coin.BacksideUrl ? coin.BacksideUrl : coin['Coin Image']}
                        alt={coin['Coin Name']}
                        className="absolute inset-0 w-full h-full object-contain select-none"
                        width="300"
                        height="300"
                        loading="lazy"
                        draggable="false"
                        style={{
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                          pointerEvents: 'none'
                        }}
                        onLoad={() => {
                          setLoadingImages(prev => ({
                            ...prev,
                            [coin.id]: false
                          }));
                        }}
                        onError={() => {
                          setLoadingImages(prev => ({
                            ...prev,
                            [coin.id]: false
                          }));
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
                    </div>
                  </div>
                </Link>
              </div>
            ))}
            
            {/* Add skeleton loaders for loading state */}
            {loading && Array.from({ length: 6 }).map((_, index) => (
              <CoinSkeleton key={`skeleton-${index}`} />
            ))}
          </div>

          {coins.length === 0 && !loading && (
            <div className="text-center text-gray-400 mt-8">
              <p className="text-lg">No public coins available in this collection.</p>
            </div>
          )}

          {hasMore && (
            <div ref={loadMoreRef} className="flex justify-center mt-8">
              {loadingMore ? (
                <div className="text-white">Loading more coins...</div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
};