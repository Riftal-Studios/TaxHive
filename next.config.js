/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker builds
  ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  // Enable source maps in production for better error tracking
  productionBrowserSourceMaps: true,
  // Note: ESLint config removed - Next.js 16 no longer supports eslint in next.config.js
  // Run ESLint separately via: npm run lint
  typescript: {
    // Skip type checking during production build (already checked in development)
    ignoreBuildErrors: false,
  },
  // Moved from experimental in Next.js 15
  typedRoutes: false,
  // Allow cross-origin requests in development from various hostnames/IPs
  // This enables access via localhost, local network IPs, and hostnames
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [
      'linux-2.local',
      '*.local', // Allow all .local hostnames
      '192.168.*.*', // Allow all 192.168.x.x IPs
      '10.*.*.*', // Allow all 10.x.x.x IPs
      '172.16.*.*', // Allow all 172.16.x.x IPs
    ],
  }),
}

module.exports = nextConfig