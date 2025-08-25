import React, { useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { useAdminStore } from '../store/adminStore';
import toast from 'react-hot-toast';

interface AdminActionsProps {
  coinId?: number;
  postId?: string;
  commentId?: string;
  onSuccess?: () => void;
}

export const AdminActions: React.FC<AdminActionsProps> = ({ coinId, postId, commentId, onSuccess }) => {
  const { isAdmin, deleteCoin, deletePost, deleteComment } = useAdminStore();
  const [loading, setLoading] = useState<'delete' | null>(null);

  if (!isAdmin) return null;

  const handleDelete = async () => {
    try {
      if (!confirm('Are you sure you want to delete this?')) {
        return;
      }

      setLoading('delete');

      if (coinId) {
        const result = await deleteCoin(coinId);
        if (result === 'success') {
          toast.success('Coin deleted successfully');
          onSuccess?.();
        } else {
          toast.error(result);
        }
      } else if (postId) {
        const { error } = await supabase
          .from('posts')
          .delete()
          .eq('id', postId);

        if (error) throw error;
        toast.success('Post deleted successfully');
        onSuccess?.();
      } else if (commentId) {
        const { error } = await supabase
          .from('post_comments')
          .delete()
          .eq('id', commentId);

        if (error) throw error;
        toast.success('Comment deleted successfully');
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Failed to delete');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleDelete}
        disabled={loading !== null}
        className="p-2 text-gray-400 hover:text-red-400 transition-colors rounded-full hover:bg-white/5 disabled:opacity-50 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
        title="Delete"
      >
        {loading === 'delete' ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Trash2 size={16} />
        )}
      </button>
    </div>
  );
};