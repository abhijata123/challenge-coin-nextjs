import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, CheckCircle, Clock, User, Mail, Calendar, Loader2, AlertTriangle, Eye, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import toast from 'react-hot-toast';

interface VettingWallet {
  id: number;
  wallet_address: string;
  user_id: string;
  created_at: string;
  user_details: {
    Username: string;
    'piture link': string | null;
    Status: string | null;
  } | null;
}

interface ApprovalResponse {
  success: boolean;
  transactionDigest: string;
  applicantAddress: string;
  message: string;
}

interface StatusResponse {
  applicantAddress: string;
  hasApplied: boolean;
  isApproved: boolean;
  message: string;
}

const AUTHORIZED_ADMINS = [
  'anna+test@braav.co',
  'abhijatasen18+charlotte@gmail.com',
  'ashleyblewis@gmail.com'
];

export const VettingAdminDashboard: React.FC = () => {
  const { user, loading: authLoading } = useAuthStore();
  const { theme } = useThemeStore();
  const router = useRouter();
  
  const [vettingWallets, setVettingWallets] = useState<VettingWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserForApproval, setSelectedUserForApproval] = useState<string>('');
  const [selectedUserForStatus, setSelectedUserForStatus] = useState<string>('');
  const [approvingUser, setApprovingUser] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [approvalResult, setApprovalResult] = useState<ApprovalResponse | null>(null);
  const [statusResult, setStatusResult] = useState<StatusResponse | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      
      // Check if user is authorized
      if (!AUTHORIZED_ADMINS.includes(user.email!)) {
        toast.error('Access denied: You are not authorized to view this page');
        router.push('/');
        return;
      }
      
      fetchVettingWallets();
    }
  }, [user, authLoading, router]);

  const fetchVettingWallets = async () => {
    try {
      setLoading(true);
      
      // Fetch vetting wallets with user details
      const { data: walletsData, error: walletsError } = await supabase
        .from('vetting_wallets')
        .select('id, wallet_address, user_id, created_at')
        .order('created_at', { ascending: false });
      
      if (walletsError) throw walletsError;
      
      // Fetch user details for each wallet
      const walletsWithUserDetails = await Promise.all(
        (walletsData || []).map(async (wallet) => {
          const { data: userData, error: userError } = await supabase
            .from('User Dps')
            .select('Username, "piture link", Status')
            .eq('email', wallet.user_id)
            .single();
          
          return {
            ...wallet,
            user_details: userError ? null : userData
          };
        })
      );
      
      setVettingWallets(walletsWithUserDetails);
    } catch (error) {
      console.error('Error fetching vetting wallets:', error);
      toast.error('Failed to load vetting wallets');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveVetting = async () => {
    if (!selectedUserForApproval) {
      toast.error('Please select a user to approve');
      return;
    }

    const selectedWallet = vettingWallets.find(w => w.user_id === selectedUserForApproval);
    if (!selectedWallet) {
      toast.error('Selected user wallet not found');
      return;
    }

    setApprovingUser(true);
    setApprovalResult(null);
    
    try {
      const response = await fetch('https://hook.us2.make.com/lr5q3n4i1hib7boaypq3rfpf2tnnd3cc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: selectedWallet.wallet_address
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve vetting request');
      }

      const result: ApprovalResponse = await response.json();
      setApprovalResult(result);
      
      if (result.success) {
        toast.success('Vetting approved successfully!');
      } else {
        toast.error('Approval failed');
      }
    } catch (error) {
      console.error('Error approving vetting:', error);
      toast.error('Failed to approve vetting request');
    } finally {
      setApprovingUser(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!selectedUserForStatus) {
      toast.error('Please select a user to check status');
      return;
    }

    const selectedWallet = vettingWallets.find(w => w.user_id === selectedUserForStatus);
    if (!selectedWallet) {
      toast.error('Selected user wallet not found');
      return;
    }

    setCheckingStatus(true);
    setStatusResult(null);
    
    try {
      const response = await fetch('https://hook.us2.make.com/ou5tpu6rjdk7ihk2xlsme8du2mjy84o4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: selectedWallet.wallet_address
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check vetting status');
      }

      const result: StatusResponse = await response.json();
      setStatusResult(result);
      toast.success('Status checked successfully');
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Failed to check vetting status');
    } finally {
      setCheckingStatus(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4 mx-auto" />
          <p className="text-white text-lg">Loading vetting dashboard...</p>
        </div>
      </div>
    );
  }

  // Double-check authorization on render
  if (!user || !AUTHORIZED_ADMINS.includes(user.email!)) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4 mx-auto" />
          <p className="text-white text-lg">Access Denied</p>
          <p className="text-gray-400">You are not authorized to view this page</p>
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
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Vetting Admin Dashboard</h1>
                <p className="text-gray-300">Manage crypto transaction verification requests</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Logged in as:</p>
              <p className="text-white font-medium">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Approve Vetting Section */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <h2 className="text-xl font-semibold text-white">Approve Vetting</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select User to Approve
                </label>
                <select
                  value={selectedUserForApproval}
                  onChange={(e) => setSelectedUserForApproval(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a user...</option>
                  {vettingWallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.user_id}>
                      {wallet.user_details?.Username || 'Unknown User'} ({wallet.user_id})
                    </option>
                  ))}
                </select>
              </div>

              {selectedUserForApproval && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">Selected User Details</h3>
                  {(() => {
                    const wallet = vettingWallets.find(w => w.user_id === selectedUserForApproval);
                    return wallet ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300">
                            {wallet.user_details?.Username || 'Unknown User'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300">{wallet.user_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300 font-mono text-xs">
                            {wallet.wallet_address.slice(0, 10)}...{wallet.wallet_address.slice(-8)}
                          </span>
                        </div>
                        {wallet.user_details?.Status && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-400" />
                            <span className="text-gray-300">{wallet.user_details.Status}</span>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              <button
                onClick={handleApproveVetting}
                disabled={approvingUser || !selectedUserForApproval}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {approvingUser ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle className="h-5 w-5" />
                )}
                {approvingUser ? 'Approving...' : 'Approve Vetting'}
              </button>

              {approvalResult && (
                <div className={`rounded-lg p-4 ${
                  approvalResult.success 
                    ? 'bg-green-500/10 border border-green-500/20' 
                    : 'bg-red-500/10 border border-red-500/20'
                }`}>
                  <h3 className={`font-medium mb-2 ${
                    approvalResult.success ? 'text-green-400' : 'text-red-400'
                  }`}>
                    Approval Result
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-400">Message: </span>
                      <span className="text-white">{approvalResult.message}</span>
                    </div>
                    {approvalResult.success && approvalResult.transactionDigest && (
                      <div>
                        <span className="text-gray-400">Transaction Digest: </span>
                        <span className="text-white font-mono text-xs break-all">
                          {approvalResult.transactionDigest}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Check Status Section */}
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
            <div className="flex items-center gap-2 mb-6">
              <Search className="h-6 w-6 text-blue-400" />
              <h2 className="text-xl font-semibold text-white">Check Vetting Status</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Select User to Check Status
                </label>
                <select
                  value={selectedUserForStatus}
                  onChange={(e) => setSelectedUserForStatus(e.target.value)}
                  className="w-full bg-gray-800 text-white border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a user...</option>
                  {vettingWallets.map((wallet) => (
                    <option key={wallet.id} value={wallet.user_id}>
                      {wallet.user_details?.Username || 'Unknown User'} ({wallet.user_id})
                    </option>
                  ))}
                </select>
              </div>

              {selectedUserForStatus && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-2">Selected User Details</h3>
                  {(() => {
                    const wallet = vettingWallets.find(w => w.user_id === selectedUserForStatus);
                    return wallet ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300">
                            {wallet.user_details?.Username || 'Unknown User'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300">{wallet.user_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300 font-mono text-xs">
                            {wallet.wallet_address.slice(0, 10)}...{wallet.wallet_address.slice(-8)}
                          </span>
                        </div>
                        {wallet.user_details?.Status && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-blue-400" />
                            <span className="text-gray-300">{wallet.user_details.Status}</span>
                          </div>
                        )}
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              <button
                onClick={handleCheckStatus}
                disabled={checkingStatus || !selectedUserForStatus}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {checkingStatus ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                {checkingStatus ? 'Checking...' : 'Check Status'}
              </button>

              {statusResult && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <h3 className="text-blue-400 font-medium mb-2">Status Result</h3>
                  <div className="space-y-2 text-sm">
                    <div className="bg-white/5 rounded-lg p-3">
                      <span className="text-white text-lg">{statusResult.message}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-white/5 rounded p-2">
                        <span className="text-gray-400">Has Applied: </span>
                        <span className={statusResult.hasApplied ? 'text-green-400' : 'text-red-400'}>
                          {statusResult.hasApplied ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="bg-white/5 rounded p-2">
                        <span className="text-gray-400">Is Approved: </span>
                        <span className={statusResult.isApproved ? 'text-green-400' : 'text-red-400'}>
                          {statusResult.isApproved ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Section */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {vettingWallets.length}
              </div>
              <div className="text-gray-300 text-sm">Total Wallets</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400 mb-1">
                {AUTHORIZED_ADMINS.length}
              </div>
              <div className="text-gray-300 text-sm">Authorized Admins</div>
            </div>
            <div className="bg-white/5 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-400 mb-1">
                {vettingWallets.filter(w => w.user_details).length}
              </div>
              <div className="text-gray-300 text-sm">Users with Profiles</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};