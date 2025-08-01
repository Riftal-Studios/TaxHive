#!/usr/bin/env tsx
/**
 * Test Redis connection for staging environment
 * This mimics how the queue worker connects to Redis
 */

import Redis from 'ioredis'

console.log('Testing Redis connection with staging approach...')
console.log('REDIS_URL:', process.env.REDIS_URL)
console.log('REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? '***' : 'not set')

// Parse Redis config - prefer REDIS_PASSWORD when available
let redisConfig: { host: string; port: number; password?: string }

if (process.env.REDIS_URL && process.env.REDIS_PASSWORD) {
  console.log('\nUsing REDIS_PASSWORD directly (avoiding URL encoding issues)')
  const url = new URL(process.env.REDIS_URL)
  redisConfig = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: process.env.REDIS_PASSWORD, // Use password directly
  }
} else if (process.env.REDIS_URL) {
  console.log('\nParsing password from REDIS_URL')
  const url = new URL(process.env.REDIS_URL)
  
  if (!url.password && url.username === '' && process.env.REDIS_URL.includes('://:')) {
    const match = process.env.REDIS_URL.match(/redis:\/\/:([^@]+)@/)
    if (match) {
      redisConfig = {
        host: url.hostname,
        port: parseInt(url.port || '6379', 10),
        password: decodeURIComponent(match[1]),
      }
    } else {
      throw new Error('Could not parse Redis password from URL')
    }
  } else {
    redisConfig = {
      host: url.hostname,
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
    }
  }
} else {
  console.log('\nUsing individual Redis config variables')
  redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  }
}

console.log('\nConnecting with config:', {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password ? '***' : undefined
})

const redis = new Redis({
  ...redisConfig,
  maxRetriesPerRequest: null, // Required by BullMQ
})

redis.on('error', (err) => {
  console.error('\n❌ Redis error:', err.message)
  process.exit(1)
})

redis.on('connect', () => {
  console.log('\n✅ Redis connected successfully')
})

// Test with PING
redis.ping()
  .then(() => {
    console.log('✅ PING successful')
    console.log('\nRedis connection working correctly!')
    redis.disconnect()
    process.exit(0)
  })
  .catch((err) => {
    console.error('❌ PING failed:', err.message)
    process.exit(1)
  })

// Timeout after 5 seconds
setTimeout(() => {
  console.error('\n❌ Connection timeout')
  process.exit(1)
}, 5000)