import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import Logger from '@/lib/logger'

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'gsthive',
      checks: {
        database: 'ok',
      },
    })
  } catch (error) {
    Logger.error('Health check failed:', error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'gsthive',
        checks: {
          database: 'failed',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}