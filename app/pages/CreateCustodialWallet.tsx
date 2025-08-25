import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Loader2, Copy, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import toast from 'react-hot-toast';

interface WalletResponse {
  success: boolean;
  wallet: {
    address: string;
    publicKey: string;
    privateKey: string;
    privateKeyBase64: string;
    mnemonic: string;
    seedHex: string;
  };
  message: string;
}

export const CreateCustodialWallet: React.FC = () => {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [loading, setLoading] = useState(false);
  const [walletData, setWalletData] = useState<WalletResponse | null>(null);

  const createWallet = async () => {
    if (!user?.email) {
      toast.error('Please log in to create a wallet');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://hook.us2.make.com/zhst73g2xqju2fil5vot2qydbps83boc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create wallet');
      }

      const data: WalletResponse = await response.json();
      
      if (data.success) {
        setWalletData(data);
        toast.success(data.message || 'Wallet created successfully!');
      } else {
        throw new Error(data.message || 'Failed to create wallet');
      }
    } catch (error) {
      console.error('Error creating wallet:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create wallet');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard!`);
    } catch (error) {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
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
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Wallet className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Create Custodial Wallet</h1>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Generate a secure custodial wallet for your crypto transactions. This wallet will be managed 
              securely and can be used for all your blockchain activities on our platform.
            </p>
          </div>

          {!walletData ? (
            <div className="text-center">
              <div className="bg-white/5 rounded-lg p-6 mb-8 max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-white mb-4">What you'll get:</h3>
                <ul className="text-left text-gray-300 space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span>Secure wallet address</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span>Ready for transactions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span>Blockchain compatibility</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                    <span>Secure infrastructure</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={createWallet}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 transition-all transform hover:scale-105 mx-auto shadow-lg"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <Wallet className="h-5 w-5" />
                )}
                {loading ? 'Creating Wallet...' : 'Create Custodial Wallet'}
              </button>
              
              <p className="text-sm text-gray-400 mt-4">
                Your wallet will be created for: {user?.email}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Wallet Created Successfully!</h2>
                <p className="text-green-400">{walletData.message}</p>
              </div>

              {/* Wallet Address */}
              <div className="bg-white/5 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-blue-400" />
                    Your Wallet Address
                  </h3>
                  <span className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                    Ready to Use
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-800/50 rounded-lg p-4 font-mono text-lg break-all">
                    <span className="text-gray-300">{walletData.wallet.address}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(walletData.wallet.address, 'Wallet address')}
                    className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    title="Copy wallet address"
                  >
                    <Copy className="h-5 w-5 text-white" />
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-3">
                  This is your wallet address. You can share this safely with others to receive transactions.
                </p>
              </div>

              <div className="text-center mt-8">
                <button
                  onClick={() => {
                    setWalletData(null);
                    router.refresh();
                  }}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Create Another Wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};