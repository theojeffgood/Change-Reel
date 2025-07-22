import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@/components'],
  },
  // Instrumentation is enabled by default when instrumentation.ts exists
};

export default nextConfig;
