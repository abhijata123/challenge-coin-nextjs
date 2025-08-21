import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Rotate3D, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import { useAuthStore } from '../store/authStore';
import { NewCoinBadge } from '../components/NewCoinBadge';
import { AskQuestionButton } from '../components/AskQuestionButton';
import { QuestionAnswerList } from '../components/QuestionAnswerList';

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
  created_at: string;
}

interface UserPreferences {
  Share_Dates: boolean;
  Share_Notes: boolean;
  auth_id: string;
  email: string;
  Theme: string;
}

export const PublicCoinDetails: React.FC = () => {
  const { id, username } = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme, initializeTheme } = useThemeStore();
  const [coin, setCoin] = useState<CoinDetails | null>(null);
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);
  const [showBackside, setShowBackside] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profileAuthId, setProfileAuthId] = useState<string | null>(null);
  const [isCometChatInitialized, setIsCometChatInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'questions'>('details');

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
            "defaultID": profileAuthId || 'cometchat-uid-1',
            "defaultType": 'user'
          });

          // If we have the profile's auth_id, initiate chat with that user
          if (profileAuthId) {
            (window as any).CometChatWidget.chatWithUser(profileAuthId);
          }

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
  }, [user, isCometChatInitialized, profileAuthId]);

  useEffect(() => {
    fetchCoinDetails();
  }, [id, username]);

  useEffect(() => {
    // If profile auth_id is loaded and CometChat is initialized, update the chat with the profile user
    if (profileAuthId && isCometChatInitialized && user) {
      try {
        (window as any).CometChatWidget.chatWithUser(profileAuthId);
      } catch (error) {
        console.error("Error starting chat with user:", error);
      }
    }
  }, [profileAuthId, isCometChatInitialized]);

  const fetchCoinDetails = async () => {
    if (!id || !username) return;

    try {
      // Fetch user preferences and auth_id first
      const { data: prefsData, error: prefsError } = await supabase
        .from('User Dps')
        .select('Share_Dates, Share_Notes, auth_id, email, Theme')
        .eq('Username', username)
        .single();

      if (prefsError) throw prefsError;
      setUserPrefs(prefsData);
      setProfileAuthId(prefsData.auth_id);
      
      // Initialize theme with the profile owner's email, not the current user
      initializeTheme(prefsData.email);

      // Then fetch coin details
      const { data, error } = await supabase
        .from('Challenge Coin Table')
        .select('*, created_at, "Has Copyright"')
        .eq('id', id)
        .eq('Public Display', true)
        .single();

      if (error || !data) {
        router.push('/');
        return;
      }

      setCoin(data);
    } catch (error) {
      console.error('Error fetching data:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  // Prevent right-click and other ways to save the image
  const preventSave = (e: React.MouseEvent) => {
    e.preventDefault();
    return false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading coin details...</div>
      </div>
    );
  }

  if (!coin || !userPrefs) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Coin not found or is not public</div>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href={`/collection/${coin.Username}`}
          className="flex items-center text-gray-300 hover:text-white mb-6"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Collection
        </Link>

        <div className={`bg-white/10 backdrop-blur-sm rounded-lg p-8 ${coin.Featured ? 'ring-2 ring-yellow-500' : ''}`}>
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-start gap-2">
              <h1 className="text-3xl font-bold text-white">
                {coin['Coin Name']}
              </h1>
              <NewCoinBadge dateAdded={coin.created_at} />
            </div>
            {coin.Featured && (
              <div className="flex items-center gap-2 text-yellow-500">
                <Star size={20} fill="currentColor" />
                <span>Featured</span>
              </div>
            )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

              <div className="space-y-6">
                {userPrefs.Share_Dates && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Date Issued</label>
                    <p className="text-white">
                      {new Date(coin['Date Issued']).toLocaleDateString()}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300">Mode of Acquiring</label>
                  <p className="text-white">{coin['Mode Of Acquiring']}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300">Number of Coins</label>
                  <p className="text-white">{coin['Number Of Coins']}</p>
                </div>

                {userPrefs.Share_Notes && coin['Notes'] && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300">Share Your Coin Story</label>
                    <p className="text-white">{coin['Notes']}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-end">
                <AskQuestionButton 
                  coinId={Number(id)} 
                  coinName={coin['Coin Name']} 
                />
              </div>
              
              <QuestionAnswerList 
                coinId={Number(id)} 
                isOwner={user?.email === coin.UserId} 
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};