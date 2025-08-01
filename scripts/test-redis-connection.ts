#!/usr/bin/env tsx
/**
 * Test Redis connection to debug authentication issues
 */

import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

console.log('Testing Redis connection...')
console.log('REDIS_URL:', REDIS_URL)

// Test 1: Direct URL connection
console.log('\n1. Testing direct URL connection:')
try {
  const redis1 = new Redis(REDIS_URL)
  redis1.on('error', (err) => console.error('Direct URL error:', err.message))
  redis1.on('connect', () => console.log('✅ Direct URL connection successful'))
  
  await new Promise(resolve => setTimeout(resolve, 1000))
  await redis1.ping()
  console.log('✅ PING successful with direct URL')
  redis1.disconnect()
} catch (error) {
  console.error('❌ Direct URL connection failed:', error)
}

// Test 2: Parsed config connection
console.log('\n2. Testing parsed config connection:')
try {
  const url = new URL(REDIS_URL)
  let password: string | undefined
  
  // Handle redis://:password@host format
  if (!url.password && url.username === '' && REDIS_URL.includes('://:')) {
    const match = REDIS_URL.match(/redis:\/\/:([^@]+)@/)
    if (match) {
      password = match[1]
      console.log('Extracted password (raw):', password)
      console.log('Password includes "=":', password.includes('='))
      console.log('Password includes "%3D":', password.includes('%3D'))
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
  
  console.log('Config:', { ...config, password: password ? '***' : undefined })
  
  const redis2 = new Redis(config)
  redis2.on('error', (err) => console.error('Parsed config error:', err.message))
  redis2.on('connect', () => console.log('✅ Parsed config connection successful'))
  
  await new Promise(resolve => setTimeout(resolve, 1000))
  await redis2.ping()
  console.log('✅ PING successful with parsed config')
  redis2.disconnect()
} catch (error) {
  console.error('❌ Parsed config connection failed:', error)
}

// Test 3: With decoded password
console.log('\n3. Testing with decoded password:')
try {
  const url = new URL(REDIS_URL)
  let password: string | undefined
  
  if (!url.password && url.username === '' && REDIS_URL.includes('://:')) {
    const match = REDIS_URL.match(/redis:\/\/:([^@]+)@/)
    if (match) {
      password = decodeURIComponent(match[1])
      console.log('Decoded password includes "=":', password.includes('='))
      console.log('Decoded password includes "%3D":', password.includes('%3D'))
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
  redis3.on('error', (err) => console.error('Decoded config error:', err.message))
  redis3.on('connect', () => console.log('✅ Decoded config connection successful'))
  
  await new Promise(resolve => setTimeout(resolve, 1000))
  await redis3.ping()
  console.log('✅ PING successful with decoded config')
  redis3.disconnect()
} catch (error) {
  console.error('❌ Decoded config connection failed:', error)
}

process.exit(0)