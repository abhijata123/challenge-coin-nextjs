import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { useAuthStore } from './authStore';

export type Theme = 'default' | 'us-flag' | 'army' | 'navy' | 'airforce' | 'police' | 'firefighting';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  initializeTheme: (userEmail?: string) => Promise<void>;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: 'default',
  setTheme: async (theme) => {
    const user = useAuthStore.getState().user;
    
    if (user?.email) {
      // Update theme in database
      await supabase
        .from('User Dps')
        .update({ Theme: theme })
        .eq('email', user.email);
    }
    
    set({ theme });
  },
  initializeTheme: async (userEmail?: string) => {
    try {
      let email = userEmail;
      
      // If no email provided, use logged-in user's email
      if (!email) {
        email = useAuthStore.getState().user?.email;
      }
      
      if (email) {
        const { data } = await supabase
          .from('User Dps')
          .select('Theme')
          .eq('email', email)
          .single();
        
        if (data?.Theme) {
          set({ theme: data.Theme as Theme });
        } else {
          // Reset to default if no theme found
          set({ theme: 'default' });
        }
      }
    } catch (error) {
      console.error('Error initializing theme:', error);
      set({ theme: 'default' });
    }
  }
}));