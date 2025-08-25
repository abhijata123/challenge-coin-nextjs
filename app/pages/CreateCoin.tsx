import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wand2, Loader2, Save, ArrowLeft, Info, Hash, Upload, RotateCw, Copyright } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export const CreateCoin = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const [coinName, setCoinName] = useState('');
  const [frontPrompt, setFrontPrompt] = useState('');
  const [backPrompt, setBackPrompt] = useState('');
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState<'front' | 'back' | null>(null);
  const [processing, setProcessing] = useState<'front' | 'back' | null>(null);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [numberOfCoins, setNumberOfCoins] = useState(1);
  const [addCopyright, setAddCopyright] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (user?.email) {
      fetchUsername();
      checkAdminStatus();
    }
  }, [user]);

  const fetchUsername = async () => {
    const { data, error } = await supabase
      .from('User Dps')
      .select('Username')
      .eq('email', user?.email)
      .single();

    if (!error && data) {
      setUsername(data.Username);
    }
  };

  const checkAdminStatus = async () => {
    if (!user?.email) return;
    
    const { data, error } = await supabase
      .from('User Dps')
      .select('is_admin')
      .eq('email', user.email)
      .single();

    if (!error && data) {
      setIsAdmin(data.is_admin || false);
    }
  };

  const processImage = async (base64Image: string): Promise<string> => {
    try {
      const response = await fetch(base64Image);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('image_file', blob);
      formData.append('crop', '1');
      formData.append('get_base64', '1');

      const apiResponse = await fetch('https://api.removal.ai/3.0/remove', {
        method: 'POST',
        headers: {
          'Rm-Token': '852CC948-4008-A6D9-6AE3-56B22FBDA5B8',
        },
        body: formData,
      });

      if (!apiResponse.ok) {
        throw new Error('Failed to process image');
      }

      const data = await apiResponse.json();
      
      if (!data.base64) {
        throw new Error('No base64 data received');
      }

      return `data:image/png;base64,${data.base64}`;
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image. Using original image.');
      return base64Image;
    }
  };

  const generateImage = async (side: 'front' | 'back') => {
    const prompt = side === 'front' ? frontPrompt : backPrompt;
    if (!prompt) {
      toast.error(`Please enter a description for the ${side} side`);
      return;
    }

    setGenerating(side);
    try {
      // Call the Supabase Edge Function instead of OpenAI directly
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-image`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          prompt,
          side
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image');
      }
      
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('No image data received');
      }
      
      const imageUrl = `data:image/png;base64,${result.data}`;
      setProcessing(side);
      
      const processedImage = await processImage(imageUrl);

      if (side === 'front') {
        setFrontImage(processedImage);
      } else {
        setBackImage(processedImage);
      }
    } catch (error) {
      console.error('Error generating/processing image:', error);
      toast.error('Failed to generate image. Please try again.');
    } finally {
      setGenerating(null);
      setProcessing(null);
    }
  };

  const saveCoin = async () => {
    if (!frontImage || !user?.email || !username) {
      toast.error('Missing required information');
      return;
    }

    setSaving(true);
    try {
      const { error: dbError } = await supabase
        .from('Challenge Coin Table')
        .insert([
          {
            'Coin Name': coinName || 'Untitled Coin',
            'Date Issued': new Date().toISOString().split('T')[0],
            'Coin Image': frontImage,
            'BacksideUrl': backImage,
            'Mode Of Acquiring': 'self added',
            'Number Of Coins': numberOfCoins,
            'available_quantity': numberOfCoins,
            'UserId': user.email,
            'Username': username,
            'Public Display': false,
            'Notes': `AI-generated coin based on prompts:\nFront: ${frontPrompt}\nBack: ${backPrompt}`,
            'Has Copyright': isAdmin && addCopyright
          }
        ])
        .select()
        .single();

      if (dbError) throw new Error(`Database error: ${dbError.message}`);

      toast.success('Coin added to your collection!');
      router.push('/my-collection');
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload coin');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d182a] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/my-collection')}
            className="flex items-center text-gray-300 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Collection
          </button>

          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Info className="h-4 w-4" />
            <span>AI will generate high-quality, unique coin designs based on your descriptions</span>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 space-y-12">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
              <Wand2 className="h-8 w-8 text-blue-400" />
              Create Custom Coin
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Coin Details */}
            <div className="lg:col-span-1 space-y-8">
              <div className="bg-white/5 rounded-lg p-6 space-y-6">
                <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  Coin Details
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Coin Name
                    </label>
                    <input
                      type="text"
                      value={coinName}
                      onChange={(e) => setCoinName(e.target.value)}
                      placeholder="Enter a name for your coin"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-200 mb-2">
                      Number of Coins
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={numberOfCoins}
                      onChange={(e) => setNumberOfCoins(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {isAdmin && (
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Copyright className="h-5 w-5 text-gray-300" />
                        <span className="text-gray-300">Add Copyright Tag</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addCopyright}
                          onChange={(e) => setAddCopyright(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Coin Sides */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* Front side */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Front Side</h2>
                  <button
                    onClick={() => generateImage('front')}
                    disabled={generating !== null || processing !== null || !frontPrompt}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {generating === 'front' ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : processing === 'front' ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                      <Wand2 className="h-5 w-5" />
                    )}
                    {generating === 'front' ? 'Generating...' : processing === 'front' ? 'Processing...' : 'Generate'}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Design Description
                  </label>
                  <textarea
                    value={frontPrompt}
                    onChange={(e) => setFrontPrompt(e.target.value)}
                    placeholder="Describe the front design (e.g., 'US Army Infantry Division with crossed rifles and the text HONOR AND COURAGE')"
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {frontImage && (
                  <div className="relative group bg-white/5 rounded-lg p-4">
                    <div 
                      className="relative"
                      onContextMenu={(e) => e.preventDefault()} // Prevent right-click
                    >
                      <img
                        src={frontImage}
                        alt="Front side design"
                        className="w-full rounded-lg select-none"
                        draggable="false"
                      />
                      {addCopyright && isAdmin && username && (
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          Made by {username}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setFrontImage(null);
                        generateImage('front');
                      }}
                      className="absolute top-2 right-2 p-2 bg-black/75 text-white rounded-full hover:bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RotateCw className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Back side */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Back Side (Optional)</h2>
                  <button
                    onClick={() => generateImage('back')}
                    disabled={generating !== null || processing !== null || !backPrompt}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {generating === 'back' ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : processing === 'back' ? (
                      <Loader2 className="animate-spin h-5 w-5" />
                    ) : (
                      <Wand2 className="h-5 w-5" />
                    )}
                    {generating === 'back' ? 'Generating...' : processing === 'back' ? 'Processing...' : 'Generate'}
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">
                    Design Description
                  </label>
                  <textarea
                    value={backPrompt}
                    onChange={(e) => setBackPrompt(e.target.value)}
                    placeholder="Describe the back design (e.g., 'Unit motto STRENGTH THROUGH UNITY with the year 2025 and a bald eagle emblem')"
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {backImage && (
                  <div className="relative group bg-white/5 rounded-lg p-4">
                    <div 
                      className="relative"
                      onContextMenu={(e) => e.preventDefault()} // Prevent right-click
                    >
                      <img
                        src={backImage}
                        alt="Back side design"
                        className="w-full rounded-lg select-none"
                        draggable="false"
                      />
                      {addCopyright && isAdmin && username && (
                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                          Made by {username}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setBackImage(null);
                        generateImage('back');
                      }}
                      className="absolute top-2 right-2 p-2 bg-black/75 text-white rounded-full hover:bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <RotateCw className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6">
            <button
              onClick={() => {
                setFrontImage(null);
                setBackImage(null);
                setFrontPrompt('');
                setBackPrompt('');
                setCoinName('');
                setNumberOfCoins(1);
                setAddCopyright(false);
              }}
              className="w-full sm:w-auto px-6 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors order-2 sm:order-1"
            >
              Clear All
            </button>
            <button
              onClick={saveCoin}
              disabled={saving || !frontImage || generating !== null || processing !== null}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors order-1 sm:order-2"
            >
              {saving ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              {saving ? 'Saving...' : 'Add to Collection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};