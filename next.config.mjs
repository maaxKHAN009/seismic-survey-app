import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swMinify: true,
  disable: false, // Ensure it is always active
  workboxOptions: {
    skipWaiting: true,
    disableDevLogs: true,
  },
});

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.logrocket.com https://*.lr-ingest.io",
  "connect-src 'self' https://*.logrocket.com https://*.lr-ingest.io wss://*.logrocket.com",
  "img-src 'self' data: blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data: https:",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
].join('; ');

const pwaConfig = withPWA({
  // Your existing Next.js config here
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
        ],
      },
    ];
  },
});

export default pwaConfig;