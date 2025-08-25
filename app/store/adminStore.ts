import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AdminState {
  isAdmin: boolean;
  checkAdminStatus: (email: string) => Promise<void>;
  deleteUserCoins: (userEmail: string) => Promise<string>;
  deleteCoin: (coinId: number) => Promise<string>;
  deletePost: (postId: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAdmin: false,
  
  checkAdminStatus: async (email: string) => {
    try {
      const { data, error } = await supabase
        .from('User Dps')
        .select('is_admin')
        .eq('email', email)
        .single();

      if (error) throw error;
      set({ isAdmin: data?.is_admin || false });
    } catch (error) {
      console.error('Error checking admin status:', error);
      set({ isAdmin: false });
    }
  },

  deleteUserCoins: async (userEmail: string) => {
    try {
      const { data, error } = await supabase.rpc('admin_ban_user', {
        admin_email: (await supabase.auth.getUser()).data.user?.email,
        user_email: userEmail
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error banning user:', error);
      throw error;
    }
  },

  deleteCoin: async (coinId: number) => {
    try {
      const { data, error } = await supabase.rpc('admin_delete_coin', {
        admin_email: (await supabase.auth.getUser()).data.user?.email,
        coin_id: coinId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error deleting coin:', error);
      throw error;
    }
  },

  deletePost: async (postId: string) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;
  },

  deleteComment: async (commentId: string) => {
    const { error } = await supabase
      .from('post_comments')
      .delete()
      .eq('id', commentId);

    if (error) throw error;
  }
}));