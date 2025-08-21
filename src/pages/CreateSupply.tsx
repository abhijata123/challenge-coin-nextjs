import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Loader2, CheckCircle, AlertCircle, ArrowLeft, Hash, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

interface SupplyResponse {
  success: boolean;
  message: string;
  result: {
    digest: string;
    transaction: {
      data: {
        sender: string;
        transaction: {
          transactions: Array<{
            MoveCall?: {
              package: string;
              module: string;
              function: string;
              type_arguments: string[];
            };
          }>;
        };
      };
    };
    objectChanges: Array<{
      type: string;
      objectType: string;
      objectId: string;
      owner: any;
    }>;
  };
}

export const CreateSupply: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [supplyLimit, setSupplyLimit] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SupplyResponse | null>(null);
  const [currentTokenNumber, setCurrentTokenNumber] = useState<number>(12);

  useEffect(() => {
    // Load the last used token number from localStorage
    const lastUsedNumber = localStorage.getItem('lastBraavTokenNumber');
    if (lastUsedNumber) {
      const storedNum = parseInt(lastUsedNumber);
      // Ensure we start from at least 11, or increment from stored value
      setCurrentTokenNumber(Math.max(11, storedNum + 1));
    } else {
      // Default to 11 if no previous number exists
      setCurrentTokenNumber(11);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please log in to create supply');
      return;
    }

    if (supplyLimit <= 0) {
      toast.error('Supply limit must be greater than 0');
      return;
    }

    setLoading(true);
    setResponse(null);

    try {
      // Capture the current token number for this request
      // const tokenNumberForThisRequest = currentTokenNumber;
      const tokenTypeName = `BRAAV${currentTokenNumber}`;
      
      // Immediately increment and save the counter for the next request
      // This ensures the counter advances even if the request fails
      localStorage.setItem('lastBraavTokenNumber', currentTokenNumber.toString());
      setCurrentTokenNumber(currentTokenNumber + 1);
      
      const payload = {
        supplyLimit: supplyLimit,
        tokenTypeName: tokenTypeName
      };

      const webhookResponse = await fetch('https://hook.us2.make.com/uj9756uytn1f08zrchu4cp7th7eaj0uu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!webhookResponse.ok) {
        throw new Error('Failed to create supply');
      }

      const result: SupplyResponse = await webhookResponse.json();
      setResponse(result);

      if (result.success) {
        toast.success('Supply created successfully!');
        
        // Extract data from the response and store in Supabase
        try {
          await storeSupplyData(result.result, tokenTypeName);
        } catch (error) {
          console.error('Error storing supply data:', error);
          toast.error('Supply created but failed to store data');
        }
      } else {
        toast.error(result.message || 'Failed to create supply');
      }
    } catch (error) {
      console.error('Error creating supply:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create supply');
    } finally {
      setLoading(false);
    }
  };

  const storeSupplyData = async (result: SupplyResponse['result'], contractName: string) => {
    try {
      // Extract PACKAGE_ID from transaction data
      const packageId = result.transaction.data.transaction.transactions
        .find(tx => tx.MoveCall)?.MoveCall?.package || '';
      
      // Extract RECIPIENT_ADDRESS from transaction sender
      const recipientAddress = result.transaction.data.sender;
      
      // Extract IDs from objectChanges
      let supplyCap = '';
      let lineageId = '';
      let counterId = '';
      
      result.objectChanges.forEach(change => {
        if (change.type === 'created') {
          if (change.objectType.includes('::braav_public::BRAAV<')) {
            supplyCap = change.objectId;
          } else if (change.objectType.includes('::braav_public::Lineage')) {
            lineageId = change.objectId;
          } else if (change.objectType.includes('::counter::Counter')) {
            counterId = change.objectId;
          }
        }
      });
      
      // Insert into Supabase Supplies table
      const { error } = await supabase
        .from('Supplies')
        .insert({
          SUPPLY_CAP_ID: supplyCap,
          LINEAGE_ID: lineageId,
          COUNTER_ID: counterId,
          PACKAGE_ID: packageId,
          Contract_Name: contractName,
          RECIPIENT_ADDRESS: recipientAddress
        });
      
      if (error) throw error;
      
      console.log('Supply data stored successfully:', {
        SUPPLY_CAP_ID: supplyCap,
        LINEAGE_ID: lineageId,
        COUNTER_ID: counterId,
        PACKAGE_ID: packageId,
        Contract_Name: contractName,
        RECIPIENT_ADDRESS: recipientAddress
      });
      
    } catch (error) {
      console.error('Error storing supply data:', error);
      throw error;
    }
  };

  const resetForm = () => {
    setSupplyLimit(100);
    setResponse(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Please log in to access this page</div>
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Package className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Create Token Supply</h1>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Create a new token supply with a specified limit. The system will automatically generate 
              a unique token type identifier for your supply.
            </p>
          </div>

          {!response ? (
            <form onSubmit={handleSubmit} className="space-y-8 max-w-md mx-auto">
              <div className="bg-white/5 rounded-lg p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Hash className="h-5 w-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Token Details</h3>
                </div>
                
                <div className="space-y-4">
                  {/* <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Token Type Name
                    </label>
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-blue-500/20">
                      <div className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-blue-400" />
                        <span className="text-blue-400 font-mono text-lg">BRAAV{currentTokenNumber}</span>
                        <span className="text-xs text-gray-400 bg-blue-500/20 px-2 py-1 rounded-full">
                          Auto-generated
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        This unique identifier will be automatically assigned to your token supply
                      </p>
                    </div>
                  </div> */}

                  <div>
                    <label htmlFor="supplyLimit" className="block text-sm font-medium text-gray-300 mb-2">
                      Supply Limit
                    </label>
                    <input
                      type="number"
                      id="supplyLimit"
                      min="1"
                      max="1000000"
                      value={supplyLimit}
                      onChange={(e) => setSupplyLimit(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter supply limit"
                      required
                    />
                    <p className="text-xs text-gray-400 mt-2">
                      Maximum number of tokens that can be minted (1 - 1,000,000)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={loading || supplyLimit <= 0}
                  className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all transform hover:scale-105 shadow-lg"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <Package className="h-5 w-5" />
                  )}
                  {loading ? 'Creating Supply...' : 'Create Supply'}
                </button>
              </div>
            </form>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${
                  response.success 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600' 
                    : 'bg-gradient-to-br from-red-500 to-pink-600'
                }`}>
                  {response.success ? (
                    <CheckCircle className="h-10 w-10 text-white" />
                  ) : (
                    <AlertCircle className="h-10 w-10 text-white" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">
                  {response.success ? '🎉 Supply Created Successfully!' : '❌ Creation Failed'}
                </h2>
              </div>

              <div className={`rounded-lg p-6 mb-8 ${
                response.success 
                  ? 'bg-green-500/10 border border-green-500/20' 
                  : 'bg-red-500/10 border border-red-500/20'
              }`}>
                <div className="text-center">
                  <p className={`text-lg font-medium ${
                    response.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {response.message}
                  </p>
                </div>
              </div>

              {response.success && response.result?.digest && (
                <div className="bg-white/5 rounded-lg p-6 mb-8">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Hash className="h-5 w-5 text-blue-400" />
                    Transaction Details
                  </h3>
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <div className="space-y-3">
                      <div>
                        <span className="text-gray-400 text-sm">Transaction Digest:</span>
                        <div className="bg-gray-900/50 rounded-md p-3 mt-1">
                          <code className="text-green-400 font-mono text-sm break-all">
                            {response.result.digest}
                          </code>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Token Type:</span>
                        <div className="bg-gray-900/50 rounded-md p-3 mt-1">
                          <code className="text-blue-400 font-mono text-lg">
                            {response.result.digest ? `BRAAV${currentTokenNumber - 1}` : 'N/A'}
                          </code>
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400 text-sm">Supply Limit:</span>
                        <div className="bg-gray-900/50 rounded-md p-3 mt-1">
                          <code className="text-yellow-400 font-mono text-lg">
                            {supplyLimit.toLocaleString()} tokens
                          </code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => {
                    setResponse(null);
                    setSupplyLimit(100);
                  }}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Another Supply
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="px-8 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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