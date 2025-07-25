// Load secrets before anything else
require('./lib/init')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    typedRoutes: true,
  },
}

module.exports = nextConfig