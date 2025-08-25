import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface FollowButtonProps {
  userId: string;
  username: string;
}

export const FollowButton: React.FC<FollowButtonProps> = ({ userId, username }) => {
  const { user } = useAuthStore();
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkFollowStatus();
  }, [user, userId]);

  const checkFollowStatus = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();

      if (error) throw error;
      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.id === userId) {
      toast.error('You cannot follow yourself');
      return;
    }

    setProcessing(true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', userId);

        if (error) throw error;
        toast.success(`Unfollowed ${username}`);
        setIsFollowing(false);
      } else {
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: user.id,
            following_id: userId
          });

        if (error) throw error;
        toast.success(`Following ${username}`);
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      toast.error('Failed to update follow status');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md opacity-50"
      >
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading...
      </button>
    );
  }

  return (
    <button
      onClick={handleFollow}
      disabled={processing || (user && user.id === userId)}
      className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
        isFollowing
          ? 'bg-red-600 hover:bg-red-700 text-white'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      {processing ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isFollowing ? (
        <UserMinus className="h-5 w-5" />
      ) : (
        <UserPlus className="h-5 w-5" />
      )}
      {isFollowing ? 'Unfollow' : 'Follow'}
    </button>
  );
};