/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Optimized for Vercel/Docker
  experimental: {
    reactCompiler: true,
  },
};

export default nextConfig;