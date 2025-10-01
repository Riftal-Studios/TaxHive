/**
 * Next.js Instrumentation
 * 
 * This file is loaded once when the server starts.
 * It's used to initialize monitoring and observability tools.
 */

export async function register() {
  // Server-side Sentry initialization
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  
  // Edge runtime Sentry initialization
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}