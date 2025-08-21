'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../src/store/authStore';
import { DisplayRestrictedNFT } from '../../src/pages/DisplayRestrictedNFT';
import { Layout } from '../../src/components/Layout';

export default function DisplayRestrictedNFTPage() {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <DisplayRestrictedNFT />
    </Layout>
  );
}