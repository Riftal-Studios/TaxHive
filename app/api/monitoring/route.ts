/**
 * Monitoring API Route
 * 
 * Provides endpoints for performance monitoring and custom metrics.
 * Used by Sentry tunneling to avoid ad blockers.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import Logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle Sentry envelope (tunneling)
    if (body.dsn || body.envelope) {
      // Forward to Sentry
      const sentryResponse = await fetch(
        `https://sentry.io/api/${process.env.SENTRY_PROJECT}/envelope/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-sentry-envelope',
            'X-Sentry-Auth': `Sentry sentry_key=${process.env.SENTRY_DSN?.split('@')[0].split('//')[1]}`,
          },
          body: JSON.stringify(body),
        }
      );
      
      if (!sentryResponse.ok) {
        throw new Error(`Sentry forwarding failed: ${sentryResponse.statusText}`);
      }
      
      return NextResponse.json({ success: true });
    }
    
    // Handle custom metrics
    if (body.type === 'metric') {
      const { name, value, tags = {}, unit } = body;
      
      // Track custom metrics in Sentry
      Sentry.metrics.gauge(name, value, {
        unit,
        tags,
      });
      
      // Log for debugging
      Logger.info('Custom metric recorded', {
        name,
        value,
        tags,
        unit,
      });
      
      return NextResponse.json({ success: true });
    }
    
    // Handle performance measurements
    if (body.type === 'performance') {
      const { operation, duration, tags = {} } = body;
      
      // Track performance in Sentry
      const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
      if (transaction) {
        const span = transaction.startChild({
          op: 'custom',
          description: operation,
          tags,
        });
        
        // Simulate the duration
        setTimeout(() => {
          span.finish();
        }, 0);
      }
      
      // Log for debugging
      Logger.info('Performance measurement recorded', {
        operation,
        duration,
        tags,
      });
      
      return NextResponse.json({ success: true });
    }
    
    // Handle breadcrumbs
    if (body.type === 'breadcrumb') {
      const { message, category = 'custom', level = 'info', data = {} } = body;
      
      Sentry.addBreadcrumb({
        message,
        category,
        level,
        data,
        timestamp: Date.now() / 1000,
      });
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { error: 'Invalid monitoring data type' },
      { status: 400 }
    );
  } catch (error) {
    Logger.error('Monitoring API error', { error });
    
    return NextResponse.json(
      { error: 'Failed to process monitoring data' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    // Check Sentry connectivity
    const sentryConnected = !!process.env.NEXT_PUBLIC_SENTRY_DSN;
    
    return NextResponse.json({
      status: 'healthy',
      monitoring: {
        sentry: sentryConnected,
        environment: process.env.NODE_ENV,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: 'Monitoring check failed' },
      { status: 500 }
    );
  }
}