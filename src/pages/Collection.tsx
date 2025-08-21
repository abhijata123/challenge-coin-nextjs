import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Edit2, Save, Trash2, Rotate3D, Star, MapPin, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { ThemeSelector } from '../components/ThemeSelector';
import { getBackgroundImage } from '../utils/theme';
import { useInView } from 'react-intersection-observer';
import { UserBadges } from '../components/UserBadges';
import { NewCoinBadge } from '../components/NewCoinBadge';
import { CoinSkeleton } from '../components/CoinSkeleton';

interface Coin {
  id: number;
  'Coin Name': string;
  'Coin Image': string;
  'BacksideUrl': string | null;
  'Date Issued': string;
  Priority: number;
  Featured: boolean;
  created_at: string;
  'Has Copyright': boolean;
}

interface UserProfile {
  Username: string;
  Bio: string;
  'piture link': string;
  Status: string;
  Location: string;
  is_admin: boolean;
  is_founding_member: boolean;
}

const COINS_PER_PAGE = 6; // Increased from 2 to 6 coins per page

export const Collection: React.FC = () => {
  const { user } = useAuthStore();
  const { theme, initializeTheme } = useThemeStore();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const [deletingCoinId, setDeletingCoinId] = useState<number | null>(null);
  const [flippedCoins, setFlippedCoins] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCoins, setTotalCoins] = useState(0);
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px 0px',
  });

  useEffect(() => {
    if (user) {
      initializeTheme();
      fetchUserProfile();
    }
  }, [user]);

  // Fixed: Added loadingMore and hasMore to dependencies
  const loadMoreCoins = useCallback(async () => {
    if (!profile?.Username || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const start = coins.length;
      const end = start + COINS_PER_PAGE - 1;

      const { data, error, count } = await supabase
        .from('Challenge Coin Table')
        .select('*, created_at, "Has Copyright"', { count: 'exact' })
        .eq('Username', profile.Username)
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
      
      // Check if there are more coins to load
      const totalCount = count || 0;
      setHasMore(coins.length + (data?.length || 0) < totalCount);
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
    if (!user?.email) return;
    
    try {
      const { data, error } = await supabase
        .from('User Dps')
        .select('Username, Bio, "piture link", Status, Location, is_admin, is_founding_member')
        .eq('email', user.email)
        .single();

      if (error) throw error;
      if (!data) {
        return;
      }

      setProfile(data);
      setNewBio(data.Bio || '');
      fetchTotalCoins(data.Username);
      fetchInitialCoins(data.Username);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTotalCoins = async (username: string) => {
    try {
      const { count, error } = await supabase
        .from('Challenge Coin Table')
        .select('id', { count: 'exact' })
        .eq('Username', username);

      if (error) throw error;
      setTotalCoins(count || 0);
    } catch (error) {
      console.error('Error fetching total coins:', error);
    }
  };

  const fetchInitialCoins = async (username: string) => {
    try {
      const { data, error, count } = await supabase
        .from('Challenge Coin Table')
        .select('*, created_at, "Has Copyright"', { count: 'exact' })
        .eq('Username', username)
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
      
      // Check if there are more coins to load
      const totalCount = count || 0;
      setHasMore(data ? data.length < totalCount : false);
    } catch (error) {
      console.error('Error fetching coins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBioSave = async () => {
    if (!user?.email) return;
    const { error } = await supabase
      .from('User Dps')
      .update({ Bio: newBio })
      .eq('email', user.email);

    if (error) {
      toast.error('Failed to update bio');
      return;
    }

    setProfile(prev => prev ? { ...prev, Bio: newBio } : null);
    setIsEditingBio(false);
    toast.success('Bio updated successfully');
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination || !user) return;

    // Save current state before making changes
    const previousCoins = [...coins];
    
    setIsReordering(true);
    const items = Array.from(coins);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update the Priority values based on the new order (starting from 1)
    const updatedItems = items.map((item, index) => ({
      ...item,
      Priority: index + 1
    }));

    setCoins(updatedItems);

    try {
      // Create an array of objects with id and Priority for the batch update
      const coinUpdates = updatedItems.map(item => ({
        id: item.id,
        Priority: item.Priority
      }));

      // Use the RPC function to update all priorities in a single call
      const { data, error } = await supabase.rpc(
        'update_coin_priorities',
        { p_coin_updates: coinUpdates }
      );

      if (error) throw error;
      if (data !== 'success') throw new Error(data);

      toast.success('Coin order updated successfully');
    } catch (error) {
      console.error('Error updating coin order:', error);
      // Revert to previous state instead of refetching
      setCoins(previousCoins);
      toast.error('Failed to update coin order');
    } finally {
      setIsReordering(false);
    }
  };

  const handleDeleteCoin = async (coinId: number) => {
    try {
      const coinToDelete = coins.find(coin => coin.id === coinId);
      if (!coinToDelete) return;

      const frontFileName = coinToDelete['Coin Image'].split('/').pop();
      const backFileName = coinToDelete['BacksideUrl']?.split('/').pop();

      const { error: dbError } = await supabase
        .from('Challenge Coin Table')
        .delete()
        .eq('id', coinId);

      if (dbError) throw dbError;

      if (frontFileName) {
        await supabase.storage
          .from('Coin Images')
          .remove([frontFileName]);
      }

      if (backFileName) {
        await supabase.storage
          .from('Coin Images')
          .remove([backFileName]);
      }

      setCoins(coins.filter(coin => coin.id !== coinId));
      toast.success('Coin deleted successfully');
    } catch (error) {
      console.error('Error deleting coin:', error);
      toast.error('Failed to delete coin');
    } finally {
      setDeletingCoinId(null);
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
        <div className="text-white">Loading coins...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Profile not found</div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ThemeSelector />
        
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden flex-shrink-0">
                <img
                  src={profile?.['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${profile?.Username || 'User'}`}
                  alt="Profile"
                  className="w-full h-full object-cover"
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
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 break-words">
                {profile?.Username || 'Loading...'}
              </h1>
              {isEditingBio ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <textarea
                    value={newBio}
                    onChange={(e) => setNewBio(e.target.value)}
                    maxLength={250}
                    className="flex-1 bg-white/20 text-white rounded-md p-2 backdrop-blur-sm resize-none"
                    placeholder="Tell us about yourself..."
                    rows={3}
                  />
                  <button
                    onClick={handleBioSave}
                    className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600"
                  >
                    <Save size={20} />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <p className="text-gray-300 break-words">{profile?.Bio || 'No bio yet'}</p>
                    <button
                      onClick={() => setIsEditingBio(true)}
                      className="text-blue-400 hover:text-blue-300 flex-shrink-0"
                    >
                      <Edit2 size={16} />
                    </button>
                  </div>
                  {profile?.Status && (
                    <div className="flex items-center gap-2 text-gray-300 justify-center sm:justify-start">
                      <User size={16} className="text-blue-400 flex-shrink-0" />
                      <span className="break-words">{profile.Status}</span>
                    </div>
                  )}
                  {profile?.Location && (
                    <div className="flex items-center gap-2 text-gray-300 justify-center sm:justify-start">
                      <MapPin size={16} className="text-red-400 flex-shrink-0" />
                      <span className="break-words">{profile.Location}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <h2 className="text-2xl font-bold text-white">My Collection</h2>
          <Link
            href="/upload"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Coin
          </Link>
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="coins">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {coins.map((coin, index) => (
                  <Draggable key={coin.id} draggableId={String(coin.id)} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`bg-white/5 backdrop-blur-sm rounded-lg overflow-hidden transform hover:scale-105 transition-transform duration-200 ${
                          isReordering ? 'opacity-75' : ''
                        } ${coin.Featured ? 'ring-2 ring-yellow-500' : ''}`}
                      >
                        <div className="relative group">
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
                              {coin['Has Copyright'] && profile && (
                                <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                  Made by {profile.Username}
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
                              <p className="text-sm">{new Date(coin['Date Issued']).toLocaleDateString()}</p>
                              <Link
                                href={`/coin/${coin.id}`}
                                className="mt-2 inline-block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                onClick={(e) => e.stopPropagation()}
                              >
                                View Details
                              </Link>
                              {coin.BacksideUrl && (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    toggleCoinFlip(coin.id);
                                  }}
                                  className="mt-2 flex items-center gap-2 mx-auto text-blue-400 hover:text-blue-300"
                                >
                                  <Rotate3D size={16} />
                                  Flip Coin
                                </button>
                              )}
                              {deletingCoinId === coin.id ? (
                                <div className="mt-4 flex gap-2 justify-center">
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleDeleteCoin(coin.id);
                                    }}
                                    className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setDeletingCoinId(null);
                                    }}
                                    className="bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setDeletingCoinId(coin.id);
                                  }}
                                  className="mt-4 flex items-center gap-2 mx-auto text-red-400 hover:text-red-300"
                                >
                                  <Trash2 size={16} />
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                
                {/* Add skeleton loaders for loading state */}
                {loading && Array.from({ length: 3 }).map((_, index) => (
                  <CoinSkeleton key={`skeleton-${index}`} />
                ))}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {coins.length === 0 && !loading && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-lg">Start building your collection by adding your first coin!</p>
          </div>
        )}

        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center mt-8">
            {loadingMore ? (
              <div className="text-white">Loading more coins...</div>
            ) : null}
          </div>
        )}
        
        {!hasMore && coins.length > 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p>✨ All coins loaded ({coins.length} total)</p>
            <p className="text-sm mt-1">You've reached the end of your collection!</p>
          </div>
        )}
      </div>
    </div>
  );
};