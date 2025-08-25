'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/authStore';
import { useAdminStore } from '../store/adminStore';
import { CreateCoin } from '../pages/CreateCoin';
import { Layout } from '../components/Layout';

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