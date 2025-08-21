import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';

// Email normalization utility function
const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const LoaderPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  
  const state = {
    email: searchParams.get('email') || '',
    password: searchParams.get('password') || '',
    username: searchParams.get('username') || '',
    bio: searchParams.get('bio') || '',
    profileImage: searchParams.get('profileImage') || ''
  };

  const getNextUserId = async (): Promise<number> => {
    const { data, error } = await supabase
      .from('User Dps')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data && data.length > 0 ? data[0].id + 1 : 1;
  };

  const initializeUser = async () => {
    if (!state?.email || !state?.username || !state?.password) {
      router.push('/signup');
      return;
    }

    try {
      // Normalize the email before processing
      const normalizedEmail = normalizeEmail(state.email);

      // Step 1: Create Supabase auth user first
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: state.password
      });

      if (authError) throw authError;

      // Step 2: Hit the webhook with all required data (using normalized email)
      const webhookResponse = await fetch('https://hook.us2.make.com/hbxz7jippoxosmi3129c81t3gm3hrxmd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: state.username,
          supabaseAuthId: authData.user?.id,
          email: normalizedEmail, // Use normalized email
          welcomeCoinFront: 'https://credhwdecybwcrkmhtrn.supabase.co/storage/v1/object/public/Coin%20Images//2025-04-29T21-38-55-680Z-jp534ptzzb.png',
          welcomeCoinBack: 'https://credhwdecybwcrkmhtrn.supabase.co/storage/v1/object/public/Coin%20Images//2025-04-29T21-38-58-298Z-0wsvvah9cuzg.png'
        }),
      });

      if (!webhookResponse.ok) {
        throw new Error('Failed to notify webhook');
      }

      // Step 3: Create user profile in User Dps table (using normalized email)
      const nextId = await getNextUserId();
      const { error: profileError } = await supabase
        .from('User Dps')
        .insert({
          id: nextId,
          email: normalizedEmail, // Use normalized email
          Username: state.username,
          Bio: state.bio || '',
          'piture link': state.profileImage,
          'Number Of Coins': 0,
          Share_Dates: false,
          Share_Notes: false,
          Status: '',
          Location: '',
          Theme: 'default',
          auth_id: authData.user?.id
        });

      if (profileError) throw profileError;

      // Step 4: Navigate to login
      setTimeout(() => {
        router.push('/login');
        toast.success('Account created successfully! Please log in.');
      }, 2000);

    } catch (error) {
      console.error('Error during user initialization:', error);
      
      if (retryCount < 2) {
        setRetryCount(prev => prev + 1);
        setProgress(0);
      } else {
        toast.error('Failed to complete signup. Please try again.');
        setTimeout(() => {
          router.push('/signup');
        }, 1000);
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    initializeUser();

    return () => {
      clearInterval(timer);
    };
  }, [retryCount]);

  return (
    <div className="min-h-screen bg-[#0d182a] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-8">
        <div className="flex justify-center">
          <div className="animate-bounce">
            <Logo showText={false} />
          </div>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Setting Up Your Account</h2>
        <p className="text-gray-400">Please wait while we prepare everything for you...</p>
        
        <div className="relative w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-red-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <div className="text-sm text-gray-400">
          {progress < 30 && "Creating your account..."}
          {progress >= 30 && progress < 60 && "Setting up authentication..."}
          {progress >= 60 && progress < 90 && "Almost there..."}
          {progress >= 90 && "Finalizing your account..."}
        </div>

        {retryCount > 0 && (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="animate-spin h-4 w-4 text-blue-500" />
            <span className="text-sm text-blue-400">
              Retrying... Attempt {retryCount}/2
            </span>
          </div>
        )}
      </div>
    </div>
  );
};