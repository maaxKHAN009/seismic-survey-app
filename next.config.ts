import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swMinify: true,
  disable: false,
  workboxOptions: {
    skipWaiting: true,       // New SW activates immediately
    clientsClaim: true,      // New SW takes over ALL open tabs instantly
    cleanupOutdatedCaches: true, // Delete old JS chunk caches on every deploy
    disableDevLogs: true,
  },
});

const nextConfig = withPWA({
  reactStrictMode: true,
  reactCompiler: true,
});

export default nextConfig;
