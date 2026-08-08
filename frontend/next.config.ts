import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The dev overlay badge sits on top of the bottom tab bar, which makes
  // visual comparison against the design deck unreliable.
  devIndicators: false,
  images: {
    // every illustration ships as WebP already
    formats: ['image/webp'],
  },
};

export default nextConfig;
