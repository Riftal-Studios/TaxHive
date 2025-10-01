/**
 * Sentry Edge Configuration
 * 
 * This file configures Sentry for the Edge runtime (middleware).
 * It sets up error tracking for edge functions and middleware.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment configuration
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  
  // Sampling configuration - Edge runtime should be lighter
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.5,
  
  // Error filtering
  ignoreErrors: [
    // Network errors
    'NetworkError',
    'Failed to fetch',
  ],
  
  // Before send hook for additional filtering/modification
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
      return null;
    }
    
    // Add edge runtime context
    event.contexts = {
      ...event.contexts,
      runtime: {
        name: 'edge',
        version: process.env.NODE_VERSION,
      },
    };
    
    return event;
  },
  
  // Transport options
  transportOptions: {
    keepalive: true,
  },
});