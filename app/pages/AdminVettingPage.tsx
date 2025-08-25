import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, Clock, User, Mail, Calendar, Loader2, AlertTriangle, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { getBackgroundImage } from '../utils/theme';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface PendingRequest {
  id: number;
  user_email: string;
  submitted_at: string;
  user_details: {
    username: string;
    profile_image: string | null;
    bio: string | null;
    status: string | null;
    location: string | null;
    coin_count: number;
  };
}

const AUTHORIZED_ADMINS = [
  'anna+test@braav.co',
  'abhijatasen18+charlotte@gmail.com',
  'ashleyblewis@gmail.com'
];

export const AdminVettingPage: React.FC = () => {
  const { user, loading: authLoading } = useAuthStore();
  const { theme } = useThemeStore();
  const navigate = useNavigate();
  
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<Record<number, boolean>>({});
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login');
        return;
      }
      
      // Check if user is authorized
      if (!AUTHORIZED_ADMINS.includes(user.email!)) {
        toast.error('Access denied: You are not authorized to view this page');
        navigate('/');
        return;
      }
      
      fetchPendingRequests();
    }
  }, [user, authLoading, navigate]);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.rpc('get_pending_vetting_requests');
      
      if (error) {
        console.error('Error fetching pending requests:', error);
        if (error.message.includes('Unauthorized')) {
          toast.error('Access denied: You are not authorized to view vetting requests');
          navigate('/');
          return;
        }
        throw error;
      }
      
      setPendingRequests(data || []);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      toast.error('Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: number, userEmail: string) => {
    if (!confirm(`Are you sure you want to approve the vetting request for ${userEmail}?`)) {
      return;
    }

    setApproving(prev => ({ ...prev, [requestId]: true }));
    
    try {
      const { data, error } = await supabase.rpc('approve_vetting_request', {
        request_id: requestId
      });
      
      if (error) {
        console.error('Error approving request:', error);
        if (error.message.includes('Unauthorized')) {
          toast.error('Access denied: You are not authorized to approve requests');
          navigate('/');
          return;
        }
        throw error;
      }
      
      if (data === 'success') {
        toast.success(`Successfully approved vetting request for ${userEmail}`);
        
        // Remove the approved request from the list
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        
        // Close modal if this request was selected
        if (selectedRequest?.id === requestId) {
          setSelectedRequest(null);
        }
      } else {
        throw new Error(data);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to approve request');
    } finally {
      setApproving(prev => {
        const newState = { ...prev };
        delete newState[requestId];
        return newState;
      });
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4 mx-auto" />
          <p className="text-white text-lg">Loading vetting requests...</p>
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
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Vetting Dashboard</h1>
                <p className="text-gray-300">Manage crypto transaction verification requests</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Logged in as:</p>
              <p className="text-white font-medium">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-400" />
              Pending Verification Requests ({pendingRequests.length})
            </h2>
            <button
              onClick={fetchPendingRequests}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>

          {pendingRequests.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">All Caught Up!</h3>
              <p className="text-gray-400">No pending vetting requests at this time.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="bg-white/5 rounded-lg p-6 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                        <img
                          src={
                            request.user_details.profile_image ||
                            `https://api.dicebear.com/7.x/initials/svg?seed=${request.user_details.username || request.user_email}`
                          }
                          alt={request.user_details.username || 'User'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {request.user_details.username || 'Unknown User'}
                          </h3>
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full">
                            Pending
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Mail className="h-4 w-4 text-blue-400" />
                            <span>{request.user_email}</span>
                          </div>
                          
                          {request.user_details.status && (
                            <div className="flex items-center gap-2 text-gray-300">
                              <User className="h-4 w-4 text-green-400" />
                              <span>{request.user_details.status}</span>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar className="h-4 w-4 text-purple-400" />
                            <span>
                              Submitted {formatDistanceToNow(new Date(request.submitted_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        
                        {request.user_details.bio && (
                          <p className="text-gray-400 text-sm mt-2 line-clamp-2">
                            {request.user_details.bio}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </button>
                      
                      <button
                        onClick={() => handleApprove(request.id, request.user_email)}
                        disabled={approving[request.id]}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {approving[request.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                        {approving[request.id] ? 'Approving...' : 'Approve'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d182a] rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">User Details</h2>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full overflow-hidden">
                  <img
                    src={
                      selectedRequest.user_details.profile_image ||
                      `https://api.dicebear.com/7.x/initials/svg?seed=${selectedRequest.user_details.username || selectedRequest.user_email}`
                    }
                    alt={selectedRequest.user_details.username || 'User'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {selectedRequest.user_details.username || 'Unknown User'}
                  </h3>
                  <p className="text-gray-400">{selectedRequest.user_email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Status</h4>
                  <p className="text-gray-300">{selectedRequest.user_details.status || 'Not specified'}</p>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Location</h4>
                  <p className="text-gray-300">{selectedRequest.user_details.location || 'Not specified'}</p>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Coin Count</h4>
                  <p className="text-gray-300">{selectedRequest.user_details.coin_count || 0} coins</p>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Submitted</h4>
                  <p className="text-gray-300">
                    {formatDistanceToNow(new Date(selectedRequest.submitted_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              
              {selectedRequest.user_details.bio && (
                <div className="bg-white/5 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Bio</h4>
                  <p className="text-gray-300">{selectedRequest.user_details.bio}</p>
                </div>
              )}
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-gray-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleApprove(selectedRequest.id, selectedRequest.user_email);
                    setSelectedRequest(null);
                  }}
                  disabled={approving[selectedRequest.id]}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {approving[selectedRequest.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  {approving[selectedRequest.id] ? 'Approving...' : 'Approve Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};