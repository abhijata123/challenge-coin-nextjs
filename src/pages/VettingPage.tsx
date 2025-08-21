import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, Clock, Mail, Send, UserCheck, Shield, Award, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { getBackgroundImage } from '../utils/theme';
import { useThemeStore } from '../store/themeStore';

type VettingStatus = 'loading' | 'not_submitted' | 'pending' | 'approved';

interface VettingRecord {
  id: number;
  userId: string;
  status: boolean;
  submitted_at: string;
  approved_at: string | null;
  vetting_data: any | null;
}

export const VettingPage: React.FC = () => {
  const { user, loading: authLoading } = useAuthStore();
  const navigate = useNavigate();
  const { theme } = useThemeStore();

  const [vettingStatus, setVettingStatus] = useState<VettingStatus>('loading');
  const [vettingRecord, setVettingRecord] = useState<VettingRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    } else if (user) {
      checkVettingStatus();
    }
  }, [user, authLoading, navigate]);

  const checkVettingStatus = async () => {
    if (!user?.email) {
      setVettingStatus('not_submitted');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('Vetting_Table')
        .select('*')
        .eq('userId', user.email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching vetting status:', error);
        toast.error('Failed to load vetting status');
        setVettingStatus('not_submitted');
        return;
      }

      if (data) {
        setVettingRecord(data);
        if (data.status === true) {
          setVettingStatus('approved');
        } else {
          setVettingStatus('pending');
        }
      } else {
        setVettingStatus('not_submitted');
      }
    } catch (error) {
      console.error('Unexpected error checking vetting status:', error);
      toast.error('An unexpected error occurred');
      setVettingStatus('not_submitted');
    }
  };

  const handleSubmitForVetting = async () => {
    if (!user?.email) {
      toast.error('You must be logged in to submit for vetting');
      return;
    }

    setSubmitting(true);
    try {
      // Send email to webhook - the webhook will handle database insertion
      const webhookResponse = await fetch('https://hook.us2.make.com/s9roeat3y06cv3nuqy2sfo1odvtk9kpe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userEmail: user.email }),
      });

      if (!webhookResponse.ok) {
        console.error('Webhook call failed:', await webhookResponse.text());
        throw new Error('Failed to notify the vetting team. Please try again.');
      }

      toast.success('Your account has been submitted for vetting!');
      setVettingStatus('pending');
      
      // Add a small delay to allow the webhook to process and insert the record
      setTimeout(() => {
        checkVettingStatus();
      }, 2000); // 2-second delay
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit for vetting.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (vettingStatus) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <p className="text-white text-lg">Checking your vetting status...</p>
          </div>
        );

      case 'not_submitted':
        return (
          <div className="text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <Shield className="h-12 w-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                <Award className="h-5 w-5 text-white" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4">Join Our Verified Community</h2>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Submit your account for verification to unlock exclusive features and join our trusted community of challenge coin collectors. 
              Our verification process helps maintain the quality and authenticity of our platform.
            </p>
            <h2 className="text-3xl font-bold text-white mb-4">Unlock Secure Crypto Transactions</h2>
            <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
              Submit your account for verification to enable safe and secure crypto transactions directly on this platform. 
              Our verification process ensures a trusted environment for all your digital asset activities.
            </p>
            
            <div className="bg-white/5 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <h3 className="text-lg font-semibold text-white mb-4">What you'll get:</h3>
              <ul className="text-left text-gray-300 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span>Secure Crypto Transaction Capabilities</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span>Verified badge on your profile</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span>Access to exclusive events</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                  <span>Priority support</span>
                </li>
              </ul>
            </div>

            <button
              onClick={handleSubmitForVetting}
              disabled={submitting}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 transition-all transform hover:scale-105 mx-auto shadow-lg"
            >
              {submitting ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              {submitting ? 'Submitting...' : 'Submit for Verification'}
            </button>
            
            <p className="text-sm text-gray-400 mt-4">
              Your email ({user?.email}) will be sent to our verification team
            </p>
          </div>
        );

      case 'pending':
        return (
          <div className="text-center">
            <div className="relative mb-8">
              <div className="w-24 h-24 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Clock className="h-12 w-12 text-white" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-4">Verification Pending</h2>
            <p className="text-gray-300 mb-6">
              Thank you for submitting your account for verification!
              Your request is currently under review by our team.
            </p>
            
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-6 mb-8 max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="h-6 w-6 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white">What's Next?</h3>
              </div>
              <ul className="text-left text-gray-300 space-y-2">
                <li>• Our team will review your account within 24-48 hours</li>
                <li>• You'll receive an email notification once approved</li>
                <li>• Check back here to see your verification status</li>
              </ul>
            </div>

            {vettingRecord?.submitted_at && (
              <div className="bg-white/5 rounded-lg p-4 inline-block">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>Submitted on: {new Date(vettingRecord.submitted_at).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        );

      case 'approved':
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
            
            <h2 className="text-3xl font-bold text-white mb-4">🎉 Crypto Transactions Enabled!</h2>
            <p className="text-gray-300 mb-6">
              Congratulations! Your account has been successfully verified and approved.
              You can now perform secure crypto transactions, mint NFTs, and access all blockchain features on our platform.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {vettingRecord?.approved_at && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400 mb-2">
                    <Calendar className="h-5 w-5" />
                    <span className="font-semibold">Approved Date</span>
                  </div>
                  <p className="text-white">{new Date(vettingRecord.approved_at).toLocaleString()}</p>
                </div>
              )}
              
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-400 mb-2">
                  <UserCheck className="h-5 w-5" />
                  <span className="font-semibold">Crypto Status</span>
                </div>
                <p className="text-white">Crypto Transactions Enabled</p>
              </div>
            </div>

            {vettingRecord?.vetting_data && (
              <div className="bg-white/10 rounded-lg p-6 text-left mb-8 max-w-2xl mx-auto">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <UserCheck className="h-6 w-6 text-green-400" />
                  Your Crypto Verification Details
                </h3>
                <div className="bg-gray-800/50 rounded-md p-4 overflow-auto">
                  <pre className="text-gray-200 text-sm whitespace-pre-wrap">
                    {JSON.stringify(vettingRecord.vetting_data, null, 2)}
                  </pre>
                </div>
                <p className="text-gray-400 text-xs mt-3">
                  This data was provided upon your crypto verification approval.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/')}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Profile
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white/10 backdrop-blur-sm rounded-lg shadow-xl p-8 sm:p-12">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};