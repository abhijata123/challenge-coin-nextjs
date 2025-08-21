import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Edit2, Save, ArrowLeft, Rotate3D, Star, Globe, Lock, Loader2, Copyright } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { AdminActions } from '../components/AdminActions';
import { useAdminStore } from '../store/adminStore';
import { QuestionAnswerList } from '../components/QuestionAnswerList';
import toast from 'react-hot-toast';

interface CoinDetails {
  id: number;
  'Coin Name': string;
  'Coin Image': string;
  'BacksideUrl': string | null;
  'Date Issued': string;
  'Mode Of Acquiring': string;
  'Number Of Coins': number;
  'Notes': string;
  'Awarded By': string | null;
  'Issuer Name': string | null;
  'Featured': boolean;
  'Public Display': boolean;
  'Has Copyright': boolean;
  Username: string;
  UserId: string;
}

interface UserPreferences {
  Share_Dates: boolean;
  Share_Notes: boolean;
}

export const CoinDetails: React.FC = () => {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { isAdmin } = useAdminStore();
  const [coin, setCoin] = useState<CoinDetails | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedCoin, setEditedCoin] = useState<CoinDetails | null>(null);
  const [showBackside, setShowBackside] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserPreferences>({
    Share_Dates: false,
    Share_Notes: false
  });
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'questions'>('details');

  useEffect(() => {
    if (user) {
      fetchUsername();
    }
  }, [user]);

  const fetchUsername = async () => {
    if (!user?.email) return;
    
    const { data, error } = await supabase
      .from('User Dps')
      .select('Username, Share_Dates, Share_Notes')
      .eq('email', user.email)
      .single();

    if (!error && data) {
      setUsername(data.Username);
      setUserPrefs({
        Share_Dates: data.Share_Dates || false,
        Share_Notes: data.Share_Notes || false
      });
      fetchCoinDetails(data.Username);
    }
  };

  const fetchCoinDetails = async (userUsername: string) => {
    if (!id) return;

    const { data, error } = await supabase
      .from('Challenge Coin Table')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast.error('Failed to load coin details');
      router.push('/my-collection');
      return;
    }

    setCoin(data);
    setEditedCoin(data);
  };

  const handleSave = async () => {
    if (!editedCoin || !id || !username) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('Challenge Coin Table')
        .update({
          'Coin Name': editedCoin['Coin Name'],
          'Date Issued': editedCoin['Date Issued'],
          'Number Of Coins': editedCoin['Number Of Coins'],
          'Notes': editedCoin['Notes'],
          'Awarded By': editedCoin['Awarded By'],
          'Issuer Name': editedCoin['Issuer Name'],
          'Featured': editedCoin['Featured'],
          'Public Display': editedCoin['Public Display'],
          'Mode Of Acquiring': editedCoin['Mode Of Acquiring'],
          'Has Copyright': editedCoin['Has Copyright']
        })
        .eq('id', id);

      if (error) throw error;

      setCoin(editedCoin);
      setIsEditing(false);
      toast.success('Coin details updated successfully');
    } catch (error) {
      toast.error('Failed to update coin details');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async () => {
    if (!coin || !id || !username) return;

    setSaving(true);
    try {
      const newFeaturedState = !coin.Featured;
      const { error } = await supabase
        .from('Challenge Coin Table')
        .update({ 'Featured': newFeaturedState })
        .eq('id', id);

      if (error) throw error;

      setCoin({ ...coin, Featured: newFeaturedState });
      setEditedCoin({ ...editedCoin!, Featured: newFeaturedState });
      toast.success(newFeaturedState ? 'Coin featured!' : 'Coin unfeatured');
    } catch (error) {
      toast.error('Failed to update featured status');
    } finally {
      setSaving(false);
    }
  };

  const togglePublicDisplay = async () => {
    if (!coin || !id) return;

    setUpdatingPrivacy(true);
    try {
      const newPublicState = !coin['Public Display'];
      
      // Use a direct RPC call with a longer timeout to avoid statement timeout
      const { data, error } = await supabase.rpc('update_coin_public_status', {
        p_coin_id: id,
        p_public_status: newPublicState
      });

      if (error) throw error;
      if (data !== 'success') throw new Error(data);

      setCoin({ ...coin, 'Public Display': newPublicState });
      setEditedCoin({ ...editedCoin!, 'Public Display': newPublicState });
      toast.success(newPublicState ? 'Coin is now public' : 'Coin is now private');
    } catch (error) {
      console.error('Error updating public display status:', error);
      toast.error('Failed to update public display status');
    } finally {
      setUpdatingPrivacy(false);
    }
  };

  const updateSharingPreferences = async (type: 'dates' | 'notes', value: boolean) => {
    if (!user?.email) return;

    try {
      const updateData = type === 'dates' 
        ? { Share_Dates: value } 
        : { Share_Notes: value };

      const { error } = await supabase
        .from('User Dps')
        .update(updateData)
        .eq('email', user.email);

      if (error) throw error;

      setUserPrefs(prev => ({
        ...prev,
        [type === 'dates' ? 'Share_Dates' : 'Share_Notes']: value
      }));

      toast.success(`Sharing preferences updated`);
    } catch (error) {
      console.error('Error updating sharing preferences:', error);
      toast.error('Failed to update sharing preferences');
    }
  };

  // Prevent right-click and other ways to save the image
  const preventSave = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  if (!coin || !editedCoin) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d182a] py-4 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate('/my-collection')}
            className="flex items-center text-gray-300 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Collection
          </button>
          
          <AdminActions 
            coinId={Number(id)} 
            onSuccess={() => navigate('/my-collection')}
          />
        </div>

        <div className={`bg-white/10 backdrop-blur-sm rounded-lg p-4 sm:p-8 ${coin.Featured ? 'ring-2 ring-yellow-500' : ''}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-white break-words">
              {isEditing ? (
                <input
                  type="text"
                  value={editedCoin['Coin Name']}
                  onChange={(e) =>
                    setEditedCoin({ ...editedCoin, 'Coin Name': e.target.value })
                  }
                  className="bg-gray-800 text-white px-2 py-1 rounded w-full"
                />
              ) : (
                coin['Coin Name']
              )}
            </h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <button
                onClick={togglePublicDisplay}
                disabled={updatingPrivacy}
                className={`flex items-center gap-2 ${
                  coin['Public Display'] ? 'text-green-500' : 'text-gray-400'
                } hover:text-green-400`}
                title={coin['Public Display'] ? 'Make private' : 'Make public'}
              >
                <Globe size={20} />
                <span className="hidden sm:inline">
                  {coin['Public Display'] ? 'Public' : 'Private'}
                </span>
              </button>
              <button
                onClick={toggleFeatured}
                disabled={saving}
                className={`flex items-center gap-2 ${
                  coin.Featured ? 'text-yellow-500' : 'text-gray-400'
                } hover:text-yellow-400`}
                title={coin.Featured ? 'Remove from featured' : 'Add to featured'}
              >
                <Star size={20} fill={coin.Featured ? 'currentColor' : 'none'} />
                <span className="hidden sm:inline">
                  {coin.Featured ? 'Featured' : 'Feature'}
                </span>
              </button>
              <button
                onClick={() => {
                  if (isEditing) {
                    handleSave();
                  } else {
                    setIsEditing(true);
                  }
                }}
                disabled={saving}
                className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
              >
                {isEditing ? (
                  <>
                    <Save size={20} />
                    {saving ? 'Saving...' : 'Save'}
                  </>
                ) : (
                  <>
                    <Edit2 size={20} />
                    <span className="hidden sm:inline">Edit</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mb-6 border-b border-white/10">
            <div className="flex space-x-4">
              <button
                onClick={() => setActiveTab('details')}
                className={`py-2 px-4 font-medium ${
                  activeTab === 'details'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('questions')}
                className={`py-2 px-4 font-medium ${
                  activeTab === 'questions'
                    ? 'text-blue-400 border-b-2 border-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Questions & Answers
              </button>
            </div>
          </div>

          {activeTab === 'details' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="space-y-6">
                <div className="relative">
                  <div 
                    className="relative"
                    onContextMenu={preventSave} // Prevent right-click
                  >
                    <img
                      src={showBackside && coin.BacksideUrl ? coin.BacksideUrl : coin['Coin Image']}
                      alt={coin['Coin Name']}
                      className="w-full rounded-lg shadow-lg select-none"
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
                  {coin.BacksideUrl && (
                    <button
                      onClick={() => setShowBackside(!showBackside)}
                      className="absolute bottom-4 right-4 bg-black/50 text-white px-4 py-2 rounded-full flex items-center gap-2 hover:bg-black/70"
                    >
                      <Rotate3D size={16} />
                      {showBackside ? 'Show Front' : 'Show Back'}
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">Date Issued</label>
                    <div className="flex items-center">
                      <span className="text-xs text-gray-400 mr-2">Share with public</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={userPrefs.Share_Dates}
                          onChange={(e) => updateSharingPreferences('dates', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editedCoin['Date Issued']}
                      onChange={(e) =>
                        setEditedCoin({ ...editedCoin, 'Date Issued': e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white"
                    />
                  ) : (
                    <p className="text-white">
                      {new Date(coin['Date Issued']).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Mode of Acquiring</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedCoin['Mode Of Acquiring']}
                      onChange={(e) =>
                        setEditedCoin({ ...editedCoin, 'Mode Of Acquiring': e.target.value })
                      }
                      className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white"
                    />
                  ) : (
                    <p className="text-white">{coin['Mode Of Acquiring']}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Number of Coins</label>
                  {isEditing ? (
                    <input
                      type="number"
                      min="1"
                      value={editedCoin['Number Of Coins']}
                      onChange={(e) =>
                        setEditedCoin({
                          ...editedCoin,
                          'Number Of Coins': parseInt(e.target.value),
                        })
                      }
                      className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white"
                    />
                  ) : (
                    <p className="text-white">{coin['Number Of Coins']}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">Share Your Coin Story</label>
                    <div className="flex items-center">
                      <span className="text-xs text-gray-400 mr-2">Share with public</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={userPrefs.Share_Notes}
                          onChange={(e) => updateSharingPreferences('notes', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={editedCoin['Notes'] || ''}
                      onChange={(e) =>
                        setEditedCoin({ ...editedCoin, 'Notes': e.target.value })
                      }
                      rows={4}
                      className="mt-1 block w-full rounded-md border-gray-700 bg-gray-800 text-white"
                    />
                  ) : (
                    <p className="text-white">{coin['Notes'] || 'No story shared yet'}</p>
                  )}
                </div>

                {isAdmin && (
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Copyright className="h-5 w-5 text-gray-300" />
                      <span className="text-gray-300">Add Copyright Tag</span>
                    </div>
                    {isEditing ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editedCoin['Has Copyright']}
                          onChange={(e) =>
                            setEditedCoin({ ...editedCoin, 'Has Copyright': e.target.checked })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    ) : (
                      <span className="text-gray-300">{coin['Has Copyright'] ? 'Enabled' : 'Disabled'}</span>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">Privacy Setting</label>
                    <div className="flex items-center">
                      <button
                        onClick={togglePublicDisplay}
                        disabled={updatingPrivacy}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          coin['Public Display'] ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`${
                            coin['Public Display'] ? 'translate-x-6' : 'translate-x-1'
                          } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                      </button>
                      <span className="ml-3 text-sm text-gray-300">
                        {updatingPrivacy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : coin['Public Display'] ? (
                          'Public'
                        ) : (
                          'Private'
                        )}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {coin['Public Display'] 
                      ? 'This coin is visible to everyone in the coin forum' 
                      : 'This coin is only visible to you'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <QuestionAnswerList 
                coinId={Number(id)} 
                isOwner={true} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};