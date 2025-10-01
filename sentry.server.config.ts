/**
 * Sentry Server Configuration
 * 
 * This file configures Sentry for the Node.js runtime.
 * It sets up error tracking and performance monitoring for server-side code.
 */

import * as Sentry from '@sentry/nextjs';
import { ProfilingIntegration } from '@sentry/profiling-node';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment configuration
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  
  // Sampling configuration
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Performance monitoring
  integrations: [
    // Profiling integration for performance monitoring
    new ProfilingIntegration(),
    // Database query tracking
    Sentry.prismaIntegration(),
  ],
  
  // Error filtering
  ignoreErrors: [
    // Ignore non-critical errors
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'EPIPE',
  ],
  
  // Before send hook for additional filtering/modification
  beforeSend(event, hint) {
    // Don't send events in development unless explicitly enabled
    if (process.env.NODE_ENV === 'development' && !process.env.SENTRY_DEV_ENABLED) {
      return null;
    }
    
    // Filter out sensitive data from error messages
    if (event.exception?.values) {
      event.exception.values = event.exception.values.map(exception => {
        if (exception.value) {
          // Remove potential passwords, tokens, etc.
          exception.value = exception.value
            .replace(/password=\S+/gi, 'password=[REDACTED]')
            .replace(/token=\S+/gi, 'token=[REDACTED]')
            .replace(/key=\S+/gi, 'key=[REDACTED]');
        }
        return exception;
      });
    }
    
    return event;
  },
  
  // Server-specific options
  spotlight: process.env.NODE_ENV === 'development',
  
  // Transport options
  transportOptions: {
    keepalive: true,
  },
});