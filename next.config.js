/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  transpilePackages: ["framer-motion"],
  experimental: {
    serverComponentsExternalPackages: ["resend"],
  },
};

module.exports = nextConfig;
