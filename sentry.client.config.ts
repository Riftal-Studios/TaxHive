/**
 * Sentry Client Configuration
 * 
 * This file configures Sentry for the browser runtime.
 * It sets up error tracking, performance monitoring, and session replay.
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment configuration
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  
  // Sampling configuration
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Performance monitoring
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
    Sentry.browserTracingIntegration(),
  ],
  
  // Error filtering
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    // Network errors
    'Network request failed',
    'NetworkError',
    'Failed to fetch',
  ],
  
  // Before send hook for additional filtering/modification
  beforeSend(event, hint) {
    // Filter out errors from browser extensions
    if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
      frame => frame.filename?.includes('extension://')
    )) {
      return null;
    }
    
    // Add user context if available
    if (typeof window !== 'undefined' && window.localStorage) {
      const userEmail = window.localStorage.getItem('userEmail');
      if (userEmail) {
        event.user = { email: userEmail };
      }
    }
    
    return event;
  },
  
  // Transport options
  transportOptions: {
    keepalive: true,
  },
});