#!/usr/bin/env tsx
/**
 * Test Redis connection to debug authentication issues
 */

import Redis from 'ioredis'
import { Logger } from '../../lib/logger'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

Logger.info('Testing Redis connection...')
Logger.info('REDIS_URL:', REDIS_URL)

// Test 1: Direct URL connection
Logger.info('\n1. Testing direct URL connection:')
try {
  const redis1 = new Redis(REDIS_URL)
  redis1.on('error', (err) => Logger.error('Direct URL error:', err.message))
  redis1.on('connect', () => Logger.info('✅ Direct URL connection successful'))
  
  await new Promise(resolve => setTimeout(resolve, 1000))
  await redis1.ping()
  Logger.info('✅ PING successful with direct URL')
  redis1.disconnect()
} catch (error) {
  Logger.error('❌ Direct URL connection failed:', error)
}

// Test 2: Parsed config connection
Logger.info('\n2. Testing parsed config connection:')
try {
  const url = new URL(REDIS_URL)
  let password: string | undefined
  
  // Handle redis://:password@host format
  if (!url.password && url.username === '' && REDIS_URL.includes('://:')) {
    const match = REDIS_URL.match(/redis:\/\/:([^@]+)@/)
    if (match) {
      password = match[1]
      Logger.info('Extracted password (raw):', password)
      Logger.info('Password includes "=":', password.includes('='))
      Logger.info('Password includes "%3D":', password.includes('%3D'))
    }
  } else {
    password = url.password || undefined
  }
  
  const config = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: password,
    maxRetriesPerRequest: null,
  }
  
  Logger.info('Config:', { ...config, password: password ? '***' : undefined })
  
  const redis2 = new Redis(config)
  redis2.on('error', (err) => Logger.error('Parsed config error:', err.message))
  redis2.on('connect', () => Logger.info('✅ Parsed config connection successful'))
  
  await new Promise(resolve => setTimeout(resolve, 1000))
  await redis2.ping()
  Logger.info('✅ PING successful with parsed config')
  redis2.disconnect()
} catch (error) {
  Logger.error('❌ Parsed config connection failed:', error)
}

// Test 3: With decoded password
Logger.info('\n3. Testing with decoded password:')
try {
  const url = new URL(REDIS_URL)
  let password: string | undefined
  
  if (!url.password && url.username === '' && REDIS_URL.includes('://:')) {
    const match = REDIS_URL.match(/redis:\/\/:([^@]+)@/)
    if (match) {
      password = decodeURIComponent(match[1])
      Logger.info('Decoded password includes "=":', password.includes('='))
      Logger.info('Decoded password includes "%3D":', password.includes('%3D'))
    }
  } else {
    password = url.password || undefined
  }
  
  const config = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: password,
    maxRetriesPerRequest: null,
  }
  
  const redis3 = new Redis(config)
  redis3.on('error', (err) => Logger.error('Decoded config error:', err.message))
  redis3.on('connect', () => Logger.info('✅ Decoded config connection successful'))
  
  await new Promise(resolve => setTimeout(resolve, 1000))
  await redis3.ping()
  Logger.info('✅ PING successful with decoded config')
  redis3.disconnect()
} catch (error) {
  Logger.error('❌ Decoded config connection failed:', error)
}

process.exit(0)