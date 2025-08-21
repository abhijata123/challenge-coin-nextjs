'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../src/store/authStore';
import { useAdminStore } from '../../src/store/adminStore';
import { CreateCoin } from '../../src/pages/CreateCoin';
import { Layout } from '../../src/components/Layout';

export default function CreatePage() {
  const { user, loading } = useAuthStore();
  const { isAdmin } = useAdminStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !isAdmin) {
      router.push('/');
    }
  }, [user, loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <Layout>
      <CreateCoin />
    </Layout>
  );
}