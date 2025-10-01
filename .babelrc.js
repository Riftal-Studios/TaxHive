/**
 * Babel Configuration for MUI Optimization
 * 
 * Optimizes Material-UI imports for smaller bundle sizes.
 * Transforms imports to use direct paths instead of barrel imports.
 */

module.exports = {
  presets: ['next/babel'],
  plugins: [
    // Transform MUI imports to direct imports for better tree-shaking
    [
      'babel-plugin-import',
      {
        libraryName: '@mui/material',
        libraryDirectory: '',
        camel2DashComponentName: false,
      },
      'mui-material',
    ],
    [
      'babel-plugin-import',
      {
        libraryName: '@mui/icons-material',
        libraryDirectory: '',
        camel2DashComponentName: false,
      },
      'mui-icons',
    ],
  ],
  // Only apply in production for optimal builds
  env: {
    production: {
      plugins: [
        // Remove console logs in production
        ['transform-remove-console', { exclude: ['error', 'warn'] }],
      ],
    },
  },
};