/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: false,
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    VERSION: process.env.VERSION,
  },
};

export default nextConfig;
