import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Image, Package, ArrowLeft, Send, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import toast from 'react-hot-toast';

interface Coin {
  id: number;
  'Coin Name': string;
  'Coin Image': string;
  'BacksideUrl': string | null;
  'Date Issued': string;
  'Number Of Coins': number;
  'Notes': string;
  'Mode Of Acquiring': string;
  'Username': string;
  'Public Display': boolean;
}

interface Supply {
  id: number;
  Contract_Name: string;
  SUPPLY_CAP_ID: string;
  LINEAGE_ID: string;
  COUNTER_ID: string;
  PACKAGE_ID: string;
  RECIPIENT_ADDRESS: string;
  created_at: string;
}

interface WebhookResponse {
  displayId: string;
}

export const DisplayNFT: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  
  const [coins, setCoins] = useState<Coin[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user?.email) return;

    try {
      setLoading(true);

      // Fetch user's coins
      const { data: coinsData, error: coinsError } = await supabase
        .from('Challenge Coin Table')
        .select('*')
        .eq('UserId', user.email)
        .order('created_at', { ascending: false });

      if (coinsError) throw coinsError;

      // Fetch all supplies
      const { data: suppliesData, error: suppliesError } = await supabase
        .from('Supplies')
        .select('*')
        .order('created_at', { ascending: false });

      if (suppliesError) throw suppliesError;

      setCoins(coinsData || []);
      setSupplies(suppliesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generatePublicLink = (coin: Coin): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/collection/${coin.Username}/coin/${coin.id}`;
  };

  const handleDisplayNFT = async () => {
    if (!selectedCoin || !selectedSupply) {
      toast.error('Please select both a coin and a supply');
      return;
    }

    setSubmitting(true);
    setResponse(null);
    setError(null);

    try {
      const payload = {
        coinName: selectedCoin['Coin Name'],
        coinImageUrl: selectedCoin['Coin Image'],
        coinDescription: selectedCoin['Notes'] || '',
        coinPublicLink: generatePublicLink(selectedCoin),
        contractName: selectedSupply.Contract_Name
      };

      const webhookResponse = await fetch('https://hook.us2.make.com/dy42mp4dh4ggprldqmsnzfxo5ngsg8ri', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        throw new Error(errorText || 'Failed to display NFT');
      }

      const displayId = await webhookResponse.text();
      setResponse(displayId.trim());
      toast.success('NFT displayed successfully!');
    } catch (error) {
      console.error('Error displaying NFT:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to display NFT';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCoin(null);
    setSelectedSupply(null);
    setResponse(null);
    setError(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Please log in to access this page</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4 mx-auto" />
          <p className="text-white text-lg">Loading your coins and supplies...</p>
        </div>
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Image className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Display NFT</h1>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Select one of your coins and a supply to display it as an NFT. Your coin will be showcased with all its details.
            </p>
          </div>

          {!response ? (
            <div className="space-y-8 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Coin Selection */}
                <div className="bg-white/5 rounded-lg p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Image className="h-5 w-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Select Your Coin</h3>
                  </div>
                  
                  <select
                    value={selectedCoin?.id || ''}
                    onChange={(e) => {
                      const coin = coins.find(c => c.id === parseInt(e.target.value));
                      setSelectedCoin(coin || null);
                    }}
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a coin...</option>
                    {coins.map((coin) => (
                      <option key={coin.id} value={coin.id}>
                        {coin['Coin Name']}
                      </option>
                    ))}
                  </select>

                  {selectedCoin && (
                    <div className="mt-4 p-4 bg-white/5 rounded-lg">
                      <h4 className="text-white font-medium mb-3">Coin Preview</h4>
                      <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                        <img
                          src={selectedCoin['Coin Image']}
                          alt={selectedCoin['Coin Name']}
                          className="w-16 h-16 object-contain rounded bg-white/10 p-2 flex-shrink-0"
                        />
                        <div className="text-center sm:text-left">
                          <p className="text-white font-medium">{selectedCoin['Coin Name']}</p>
                          <p className="text-sm text-gray-400">
                            {selectedCoin['Number Of Coins']} coins owned
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Date Issued: </span>
                          <span className="text-white">
                            {new Date(selectedCoin['Date Issued']).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Mode: </span>
                          <span className="text-white">{selectedCoin['Mode Of Acquiring']}</span>
                        </div>
                        {selectedCoin['Notes'] && (
                          <div>
                            <span className="text-gray-400">Description: </span>
                            <span className="text-white break-words">{selectedCoin['Notes']}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400">Public Link: </span>
                          <a
                            href={generatePublicLink(selectedCoin)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 break-all"
                          >
                            View Public Page
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {coins.length === 0 && (
                    <div className="mt-4 text-center text-gray-400">
                      <Image className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No coins available</p>
                      <p className="text-xs mt-1">Add some coins to your collection first</p>
                    </div>
                  )}
                </div>

                {/* Supply Selection */}
                <div className="bg-white/5 rounded-lg p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-purple-400" />
                    <h3 className="text-lg font-semibold text-white">Select Supply</h3>
                  </div>
                  
                  <select
                    value={selectedSupply?.id || ''}
                    onChange={(e) => {
                      const supply = supplies.find(s => s.id === parseInt(e.target.value));
                      setSelectedSupply(supply || null);
                    }}
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select a supply...</option>
                    {supplies.map((supply) => (
                      <option key={supply.id} value={supply.id}>
                        {supply.Contract_Name}
                      </option>
                    ))}
                  </select>

                  {selectedSupply && (
                    <div className="mt-4 p-4 bg-white/5 rounded-lg">
                      <h4 className="text-white font-medium mb-2">Supply Details</h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Contract: </span>
                          <span className="text-white font-mono">{selectedSupply.Contract_Name}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Package ID: </span>
                          <div className="bg-gray-800/50 rounded-md p-2 mt-1">
                            <span className="text-white font-mono text-xs break-all">
                            {selectedSupply.PACKAGE_ID}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Created: </span>
                          <span className="text-white">
                            {new Date(selectedSupply.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {supplies.length === 0 && (
                    <div className="mt-4 text-center text-gray-400">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No supplies available</p>
                      <p className="text-xs mt-1">Create a supply first</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="text-center px-4">
                <button
                  onClick={handleDisplayNFT}
                  disabled={submitting || !selectedCoin || !selectedSupply}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg mx-auto"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin h-6 w-6" />
                  ) : (
                    <Send className="h-6 w-6" />
                  )}
                  {submitting ? 'Displaying NFT...' : 'Display as NFT'}
                </button>

                {(!selectedCoin || !selectedSupply) && (
                  <p className="text-sm text-gray-400 mt-4">
                    Please select both a coin and a supply to proceed
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4">
              {error ? (
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">❌ Display Failed</h2>
                  <p className="text-lg text-red-400">{error}</p>
                </div>
              ) : (
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-10 w-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-white mb-4">🎉 Display Created Successfully!</h2>
                  <p className="text-lg text-green-400 mb-6">
                    Your NFT has been created and is now available on the blockchain.
                  </p>
                  
                  {/* Display URL */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold text-white mb-4">View Your NFT</h3>
                    <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4">
                      <a
                        href={`https://testnet.suivision.xyz/object/${response}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 font-mono text-xs sm:text-sm break-all flex flex-col items-center gap-2 justify-center text-center"
                      >
                        <ExternalLink className="h-5 w-5 flex-shrink-0" />
                        <span className="break-all leading-relaxed">https://testnet.suivision.xyz/object/{response}</span>
                      </a>
                    </div>
                    <p className="text-gray-400 text-sm mt-3">
                      Click the link above to view your NFT on the Sui blockchain explorer
                    </p>
                  </div>
                  
                  {/* NFT Summary */}
                  {selectedCoin && selectedSupply && (
                    <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-6">
                      <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                        <Image className="h-6 w-6 text-purple-400" />
                        NFT Details
                      </h3>
                      <div className="space-y-6">
                        <div className="flex flex-col items-center gap-4">
                          <img
                            src={selectedCoin['Coin Image']}
                            alt={selectedCoin['Coin Name']}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-lg bg-white/10 p-2 flex-shrink-0"
                          />
                          <div className="text-center">
                            <h4 className="text-white font-semibold">{selectedCoin['Coin Name']}</h4>
                            <p className="text-gray-400 text-sm">Challenge Coin NFT</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 text-sm">
                          <div className="bg-white/5 rounded-lg p-3">
                            <span className="text-gray-400">Contract: </span>
                            <span className="text-white font-mono">{selectedSupply.Contract_Name}</span>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <span className="text-gray-400">Display ID: </span>
                            <div className="bg-gray-800/50 rounded-md p-2 mt-1">
                              <span className="text-white font-mono text-xs break-all">{response}</span>
                            </div>
                          </div>
                          <div className="bg-white/5 rounded-lg p-3">
                            <span className="text-gray-400">Date Issued: </span>
                            <span className="text-white">
                              {new Date(selectedCoin['Date Issued']).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <button
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Display Another NFT
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};