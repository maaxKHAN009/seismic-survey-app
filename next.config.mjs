import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swMinify: true,
  disable: false, // Ensure it is always active
  workboxOptions: {
    skipWaiting: true,    // New SW activates immediately without waiting for old tabs to close
    clientsClaim: true,   // New SW takes control of ALL open tabs instantly on activation
    disableDevLogs: true,
  },
});

const pwaConfig = withPWA({
  // Your existing Next.js config here
  reactStrictMode: true,
});

export default pwaConfig;