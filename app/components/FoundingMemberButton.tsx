import React, { useState } from 'react';
import { Award, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';

interface FoundingMemberButtonProps {
  userEmail: string;
  isFoundingMember: boolean;
  onSuccess?: () => void;
}

export const FoundingMemberButton: React.FC<FoundingMemberButtonProps> = ({
  userEmail,
  isFoundingMember,
  onSuccess
}) => {
  const { user } = useAuthStore();
  const { isAdmin } = useAdminStore();
  const [loading, setLoading] = useState(false);

  if (!isAdmin || !user) return null;

  const handleToggle = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc(
        'set_founding_member_status',
        {
          admin_email: user.email,
          target_email: userEmail,
          is_founding: !isFoundingMember
        }
      );

      if (error) throw error;
      if (data !== 'success') throw new Error(data);

      toast.success(`${isFoundingMember ? 'Removed from' : 'Added to'} founding members`);
      onSuccess?.();
    } catch (error) {
      console.error('Error updating founding member status:', error);
      toast.error('Failed to update founding member status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        isFoundingMember
          ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Award className="h-5 w-5" />
      )}
      {isFoundingMember ? 'Remove Founding Member' : 'Make Founding Member'}
    </button>
  );
};