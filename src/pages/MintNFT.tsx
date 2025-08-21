import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Package, ArrowLeft, Loader2, CheckCircle, AlertCircle, ExternalLink, Image, Wallet, Coins } from 'lucide-react';
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
  UserId: string;
  created_at: string;
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

interface RecipientWallet {
  id: number;
  wallet_address: string;
  user_id: string;
  created_at: string;
  mnemonic: string;
  publicKey: string | null;
  privateKey: string | null;
  user: {
    Username: string;
    'piture link': string | null;
  };
}

export const MintNFT: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  
  const [userCoins, setUserCoins] = useState<Coin[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [recipientWallets, setRecipientWallets] = useState<RecipientWallet[]>([]);
  
  const [selectedCoin, setSelectedCoin] = useState<Coin | null>(null);
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null);
  const [selectedRecipientWallet, setSelectedRecipientWallet] = useState<RecipientWallet | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState<any | null>(null);

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

      // Fetch recipient wallets (excluding current user's wallets)
      const { data: walletsData, error: walletsError } = await supabase
        .from('vetting_wallets')
        .select('id, wallet_address, user_id, created_at, mnemonic, publicKey, privateKey')
        .neq('user_id', user.email)
        .order('created_at', { ascending: false });

      if (walletsError) throw walletsError;

      // Enrich recipient wallets with user details
      const enrichedWallets = await Promise.all(
        (walletsData || []).map(async (wallet) => {
          const { data: userData, error: userError } = await supabase
            .from('User Dps')
            .select('Username, "piture link"')
            .eq('email', wallet.user_id)
            .single();

          return {
            ...wallet,
            user: userError ? { Username: 'Unknown User', 'piture link': null } : userData
          };
        })
      );

      setUserCoins(coinsData || []);
      setSupplies(suppliesData || []);
      setRecipientWallets(enrichedWallets);
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

  const handleTransferNFT = async () => {
    if (!selectedCoin || !selectedSupply || !selectedRecipientWallet) {
      toast.error('Please select a coin, supply, and recipient wallet');
      return;
    }

    setSubmitting(true);
    setResponse(null);

    try {
      const payload = {
        coin: {
          id: selectedCoin.id,
          name: selectedCoin['Coin Name'],
          image: selectedCoin['Coin Image'],
          backsideUrl: selectedCoin['BacksideUrl'],
          dateIssued: selectedCoin['Date Issued'],
          numberOfCoins: selectedCoin['Number Of Coins'],
          notes: selectedCoin['Notes'],
          modeOfAcquiring: selectedCoin['Mode Of Acquiring'],
          username: selectedCoin['Username'],
          publicDisplay: selectedCoin['Public Display'],
          userId: selectedCoin.UserId,
          createdAt: selectedCoin.created_at,
          publicLink: generatePublicLink(selectedCoin)
        },
        supply: {
          id: selectedSupply.id,
          contractName: selectedSupply.Contract_Name,
          supplyCapId: selectedSupply.SUPPLY_CAP_ID,
          lineageId: selectedSupply.LINEAGE_ID,
          counterId: selectedSupply.COUNTER_ID,
          packageId: selectedSupply.PACKAGE_ID,
          recipientAddress: selectedSupply.RECIPIENT_ADDRESS,
          createdAt: selectedSupply.created_at
        },
        recipientWallet: {
          id: selectedRecipientWallet.id,
          walletAddress: selectedRecipientWallet.wallet_address,
          userId: selectedRecipientWallet.user_id,
          createdAt: selectedRecipientWallet.created_at,
          mnemonic: selectedRecipientWallet.mnemonic,
          publicKey: selectedRecipientWallet.publicKey,
          privateKey: selectedRecipientWallet.privateKey,
          user: {
            username: selectedRecipientWallet.user.Username,
            pictureLink: selectedRecipientWallet.user['piture link']
          }
        },
        senderEmail: user?.email
      };

      const webhookResponse = await fetch('https://hook.us2.make.com/melfgdyhgf76h87oohtb4vme8l64bjat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        throw new Error(errorText || 'Failed to transfer NFT');
      }

      const result = await webhookResponse.json();
      setResponse(result);

      toast.success('NFT transfer request sent successfully!');
    } catch (error) {
      console.error('Error transferring NFT:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to transfer NFT';
      setResponse({ error: errorMessage });
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedCoin(null);
    setSelectedSupply(null);
    setSelectedRecipientWallet(null);
    setResponse(null);
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
          <p className="text-white text-lg">Loading your coins, supplies, and recipient wallets...</p>
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
              <Send className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Transfer NFT</h1>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Select one of your coins, a supply, and a recipient wallet to transfer your NFT. All selected information will be processed securely.
            </p>
          </div>

          {!response ? (
            <div className="space-y-8 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Coin Selection */}
                <div className="bg-white/5 rounded-lg p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Coins className="h-5 w-5 text-blue-400" />
                    <h3 className="text-lg font-semibold text-white">Select Coin</h3>
                  </div>
                  
                  <select
                    value={selectedCoin?.id || ''}
                    onChange={(e) => {
                      const coin = userCoins.find(c => c.id === parseInt(e.target.value));
                      setSelectedCoin(coin || null);
                    }}
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a coin...</option>
                    {userCoins.map((coin) => (
                      <option key={coin.id} value={coin.id}>
                        {coin['Coin Name']}
                      </option>
                    ))}
                  </select>

                  {selectedCoin && (
                    <div className="mt-4 p-4 bg-white/5 rounded-lg">
                      <h4 className="text-white font-medium mb-3">Coin Preview</h4>
                      <div className="flex flex-col items-center gap-4 mb-4">
                        <img
                          src={selectedCoin['Coin Image']}
                          alt={selectedCoin['Coin Name']}
                          className="w-16 h-16 object-contain rounded bg-white/10 p-2"
                        />
                        <div className="text-center">
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

                  {userCoins.length === 0 && (
                    <div className="mt-4 text-center text-gray-400">
                      <Coins className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
                          <span className="text-gray-400">Supply Cap ID: </span>
                          <div className="bg-gray-800/50 rounded-md p-2 mt-1">
                            <span className="text-white font-mono text-xs break-all">
                              {selectedSupply.SUPPLY_CAP_ID}
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

                {/* Recipient Wallet Selection */}
                <div className="bg-white/5 rounded-lg p-4 sm:p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Wallet className="h-5 w-5 text-green-400" />
                    <h3 className="text-lg font-semibold text-white">Select Recipient Wallet</h3>
                  </div>
                  
                  <select
                    value={selectedRecipientWallet?.id || ''}
                    onChange={(e) => {
                      const wallet = recipientWallets.find(w => w.id === parseInt(e.target.value));
                      setSelectedRecipientWallet(wallet || null);
                    }}
                    className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select recipient wallet...</option>
                    {recipientWallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.user.Username} - {wallet.wallet_address?.slice(0, 6) || ''}...{wallet.wallet_address?.slice(-4) || ''}
                      </option>
                    ))}
                  </select>

                  {selectedRecipientWallet && (
                    <div className="mt-4 p-4 bg-white/5 rounded-lg">
                      <h4 className="text-white font-medium mb-3">Recipient Details</h4>
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={selectedRecipientWallet.user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedRecipientWallet.user.Username}`}
                          alt={selectedRecipientWallet.user.Username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-white font-medium">{selectedRecipientWallet.user.Username}</p>
                          <p className="text-sm text-green-400">Verified Wallet</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">Email: </span>
                          <span className="text-white">{selectedRecipientWallet.user_id}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Wallet Address: </span>
                          <div className="bg-gray-800/50 rounded-md p-2 mt-1">
                            <span className="text-white font-mono text-xs break-all">
                              {selectedRecipientWallet.wallet_address || 'No address available'}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-400">Created: </span>
                          <span className="text-white">
                            {new Date(selectedRecipientWallet.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {recipientWallets.length === 0 && (
                    <div className="mt-4 text-center text-gray-400">
                      <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No recipient wallets available</p>
                      <p className="text-xs mt-1">Other users need to create verified wallets first</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="text-center px-4">
                <button
                  onClick={handleTransferNFT}
                  disabled={submitting || !selectedCoin || !selectedSupply || !selectedRecipientWallet}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg mx-auto"
                >
                  {submitting ? (
                    <Loader2 className="animate-spin h-6 w-6" />
                  ) : (
                    <Send className="h-6 w-6" />
                  )}
                  {submitting ? 'Processing Transfer...' : 'Transfer NFT'}
                </button>

                {(!selectedCoin || !selectedSupply || !selectedRecipientWallet) && (
                  <p className="text-sm text-gray-400 mt-4">
                    Please select a coin, supply, and recipient wallet to proceed
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4">
              <div className="text-center mb-8">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  response.error 
                    ? 'bg-gradient-to-br from-red-500 to-pink-600' 
                    : 'bg-gradient-to-br from-green-500 to-emerald-600'
                }`}>
                  {response.error ? (
                    <AlertCircle className="h-10 w-10 text-white" />
                  ) : (
                    <CheckCircle className="h-10 w-10 text-white" />
                  )}
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  {response.error ? '❌ Transfer Failed' : '🎉 Transfer Response Received'}
                </h2>
                <p className="text-lg mb-6">
                  {response.error ? (
                    <span className="text-red-400">The transfer encountered an error</span>
                  ) : (
                    <span className="text-green-400">Here's the response from the transfer service</span>
                  )}
                </p>
                
                {/* Response Display */}
                <div className={`border rounded-lg p-6 mb-6 ${
                  response.error 
                    ? 'bg-red-500/10 border-red-500/20' 
                    : 'bg-green-500/10 border-green-500/20'
                }`}>
                  <h3 className="text-xl font-semibold text-white mb-4">Transfer Response</h3>
                  <div className="bg-gray-800/50 rounded-lg p-4 text-left">
                    <pre className={`font-mono text-sm whitespace-pre-wrap overflow-auto ${
                      response.error ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  </div>
                </div>
                
                {/* Transfer Summary */}
                {selectedCoin && selectedSupply && selectedRecipientWallet && !response.error && (
                  <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                      <Send className="h-6 w-6 text-blue-400" />
                      Transfer Summary
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-lg p-4">
                        <h4 className="text-blue-400 font-medium mb-2">Coin Transferred</h4>
                        <div className="flex items-center gap-3">
                          <img
                            src={selectedCoin['Coin Image']}
                            alt={selectedCoin['Coin Name']}
                            className="w-12 h-12 object-contain rounded bg-white/10 p-2"
                          />
                          <div>
                            <p className="text-white font-medium">{selectedCoin['Coin Name']}</p>
                            <p className="text-sm text-gray-400">
                              {selectedCoin['Number Of Coins']} coins
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-4">
                        <h4 className="text-purple-400 font-medium mb-2">Supply Used</h4>
                        <p className="text-white font-mono">{selectedSupply.Contract_Name}</p>
                        <p className="text-gray-400 text-sm">
                          Created {new Date(selectedSupply.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-4">
                        <h4 className="text-green-400 font-medium mb-2">Recipient</h4>
                        <div className="flex items-center gap-2">
                          <img
                            src={selectedRecipientWallet.user['piture link'] || `https://api.dicebear.com/7.x/initials/svg?seed=${selectedRecipientWallet.user.Username}`}
                            alt={selectedRecipientWallet.user.Username}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div>
                            <p className="text-white font-medium">{selectedRecipientWallet.user.Username}</p>
                            <p className="text-gray-400 text-xs">
                              {selectedRecipientWallet.wallet_address?.slice(0, 6) || ''}...{selectedRecipientWallet.wallet_address?.slice(-4) || ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <button
                  onClick={resetForm}
                  className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Transfer Another NFT
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