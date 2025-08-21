'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../src/store/authStore';
import { VettingAdminDashboard } from '../../../src/pages/VettingAdminDashboard';
import { Layout } from '../../../src/components/Layout';

const AUTHORIZED_ADMINS = [
  'anna+test@braav.co',
  'abhijatasen18+charlotte@gmail.com',
  'ashleyblewis@gmail.com'
];

export default function VettingDashboardPage() {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !AUTHORIZED_ADMINS.includes(user.email!)) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d182a] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user || !AUTHORIZED_ADMINS.includes(user.email!)) {
    return null;
  }

  return (
    <Layout>
      <VettingAdminDashboard />
    </Layout>
  );
}