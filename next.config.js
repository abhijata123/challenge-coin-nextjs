/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
      {
        protocol: 'https',
        hostname: 'credhwdecybwcrkmhtrn.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'media-hosting.imagekit.io',
      },
    ],
  },
  env: {
    VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyZWRod2RlY3lid2Nya21odHJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0NjM4NTksImV4cCI6MjA0OTAzOTg1OX0.fDkzKh0EJ4KMG3t7rrC5_kMBh7x5hcd5PS-Mc6xljwM
VITE_SUPABASE_URL=https://credhwdecybwcrkmhtrn.supabase.co
    VITE_VENLY_CLIENT_ID: process.env.VITE_VENLY_CLIENT_ID,
    VITE_VENLY_ENVIRONMENT: process.env.VITE_VENLY_ENVIRONMENT,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
