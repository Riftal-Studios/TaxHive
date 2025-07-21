import { NextRequest, NextResponse } from 'next/server'
import { updateExchangeRates } from '@/lib/exchange-rates'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
      success: true,
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