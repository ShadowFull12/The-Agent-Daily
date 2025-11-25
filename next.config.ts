
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      }
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
      maxDuration: 900, // Maximum 15 minutes for server actions
    },
  },
};

export default nextConfig;
