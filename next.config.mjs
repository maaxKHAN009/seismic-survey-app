/** @type {import('next').Config} */
const nextConfig = {
    // Required for PWA file serving
    reactStrictMode: true,
    // This ensures your custom sw.js in /public is accessible
    async rewrites() {
      return [
        {
          source: '/sw.js',
          destination: '/sw.js',
        },
      ];
    },
  };
  
  export default nextConfig;