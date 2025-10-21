/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    typedRoutes: false,
  },
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