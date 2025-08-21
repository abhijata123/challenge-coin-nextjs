import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { Logo } from '../components/Logo';

const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const Login: React.FC = () => {
  const router = useRouter();
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = normalizeEmail(email);

      const { data: userData, error: userError } = await supabase
        .from('User Dps')
        .select('email')
        .eq('email', normalizedEmail)
        .single();

      if (!userData || userError) {
        toast.error('Please sign up first to create an account');
        router.push('/signup');
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
      });

      if (signInError) throw signInError;

      setOtpSent(true);
      toast.success('OTP sent to your email!');
    } catch (error) {
      console.error('OTP send error:', error);
      toast.error('Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const normalizedEmail = normalizeEmail(email);

      const { data, error } = await supabase.auth.verifyOtp({
        email: normalizedEmail,
        token: otp,
        type: 'email',
      });

      if (error) throw error;

      toast.success('Successfully logged in!');
      router.push('/');
    } catch (error) {
      console.error('OTP verification error:', error);
      toast.error('Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  return (
    <div className="min-h-screen bg-[#0d182a] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center">
          <div className="flex justify-center w-full">
            <Logo showText={false} />
          </div>
          <p className="mt-2 text-sm text-gray-400">Sign in to manage your collection</p>
        </div>

        {!otpSent ? (
          <>
            <form className="mt-8 space-y-6" onSubmit={handleSendOtp}>
              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    'Send OTP'
                  )}
                </button>
              </div>
            </form>

            <div className="text-center">
              <p className="text-sm text-gray-400">
                New to Challenge Coins?{' '}
                <Link to="/signup" className="text-blue-500 hover:text-blue-400 font-medium">
                  Sign up here
                </Link>
              </p>
            </div>
          </>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOtp}>
            <div className="text-center text-sm text-gray-400">
              We’ve sent a 6-digit code to <strong>{normalizeEmail(email)}</strong>
            </div>

            <div>
              <label htmlFor="otp" className="sr-only">
                OTP Code
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 sm:text-sm tracking-widest text-center"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  'Verify OTP & Login'
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="text-blue-500 hover:text-blue-400 text-sm mt-2"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};