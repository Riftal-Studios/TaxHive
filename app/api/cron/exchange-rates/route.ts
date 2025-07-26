import { NextRequest, NextResponse } from 'next/server'
import { updateExchangeRates } from '@/lib/exchange-rates'

// Rate limiting for cron endpoint
const cronAttempts = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 5 * 60 * 1000 // 5 minutes
const MAX_CRON_CALLS_PER_WINDOW = 5

function checkCronRateLimit(ip: string): boolean {
  const now = Date.now()
  const attempts = cronAttempts.get(ip) || []
  
  // Filter out old attempts
  const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW)
  
  if (recentAttempts.length >= MAX_CRON_CALLS_PER_WINDOW) {
    return false
  }
  
  // Add current attempt
  recentAttempts.push(now)
  cronAttempts.set(ip, recentAttempts)
  
  return true
}

export async function GET(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // Check rate limiting
    if (!checkCronRateLimit(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Update exchange rates
    const result = await updateExchangeRates()
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update exchange rates' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Also support POST for some cron services
export async function POST(request: NextRequest) {
  return GET(request)
}