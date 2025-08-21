'use client';

import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Initialize Venly Connect
declare global {
  interface Window {
    VenlyConnect: any;
    venlyConnect: any;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      // For npm package usage
      import('@venly/connect').then((VenlyConnect) => {
        window.venlyConnect = new VenlyConnect.default(
          process.env.NEXT_PUBLIC_VENLY_CLIENT_ID,
          {
            environment: process.env.NEXT_PUBLIC_VENLY_ENVIRONMENT as 'sandbox' | 'production'
          }
        );
        console.log('Venly Connect initialized');
      }).catch(err => {
        console.error('Failed to initialize Venly Connect:', err);
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}