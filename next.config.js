const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    typedRoutes: false,
    // Optimize imports for smaller bundles
    optimizePackageImports: ['@mui/material', '@mui/icons-material', '@mui/lab'],
  },
  eslint: {
    // Allow production builds to successfully complete even if there are ESLint warnings
    ignoreDuringBuilds: false, // Keep linting during builds but don't fail on warnings
  },
  typescript: {
    // Allow production builds to successfully complete even if there are TypeScript errors
    ignoreBuildErrors: false, // Keep type checking but handle it properly
  },
  // Webpack configuration for MUI optimization
  webpack: (config, { isServer }) => {
    // Optimize MUI for production
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@mui/material': '@mui/material/modern',
        '@mui/icons-material': '@mui/icons-material/esm',
      };
    }
    
    // Enable tree shaking for MUI
    config.optimization = {
      ...config.optimization,
      sideEffects: false,
    };
    
    return config;
  },
  // Module transpilation for MUI optimization
  transpilePackages: ['@mui/material', '@mui/icons-material', '@mui/lab', '@mui/system'],
}

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Organization and project
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Suppresses source map uploading logs during build
  silent: true,
  
  // Upload source maps only in production
  dryRun: process.env.NODE_ENV !== 'production',
  
  // Hides source maps from generated client bundles
  hideSourceMaps: true,
  
  // Automatically release tracking
  release: {
    create: true,
    finalize: true,
    deploy: {
      env: process.env.NODE_ENV,
    },
  },
  
  // Tree shaking
  disableLogger: true,
  
  // Tunneling to avoid ad blockers
  tunnelRoute: '/monitoring',
  
  // Source maps
  widenClientFileUpload: true,
};

// Wrap the config with Sentry and Bundle Analyzer
module.exports = withBundleAnalyzer(
  withSentryConfig(nextConfig, sentryWebpackPluginOptions)
);