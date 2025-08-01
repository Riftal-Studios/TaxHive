#!/usr/bin/env tsx
/**
 * Debug Redis connection in production-like environment
 */

import Redis from 'ioredis'

// Simulate production environment
const REDIS_URL = 'redis://:R65JT8OWR7eZGthiaIl6dfbXl6JHk1eAeSRD2tB5c9M=@redis:6379'
const REDIS_PASSWORD = 'R65JT8OWR7eZGthiaIl6dfbXl6JHk1eAeSRD2tB5c9M='

console.log('Testing Redis connection methods...\n')

// Method 1: Direct URL (what might be happening)
console.log('1. Testing with direct URL:')
console.log('URL:', REDIS_URL)
try {
  const redis1 = new Redis(REDIS_URL)
  redis1.on('connect', () => console.log('✅ Connected with direct URL'))
  redis1.on('error', (err) => console.error('❌ Error with direct URL:', err.message))
  setTimeout(() => redis1.disconnect(), 1000)
} catch (err) {
  console.error('❌ Failed to create connection with URL:', err)
}

// Method 2: Config object with password (what we want)
console.log('\n2. Testing with config object:')
const config = {
  host: 'redis',
  port: 6379,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
}
console.log('Config:', { ...config, password: '***' })
try {
  const redis2 = new Redis(config)
  redis2.on('connect', () => console.log('✅ Connected with config object'))
  redis2.on('error', (err) => console.error('❌ Error with config object:', err.message))
  setTimeout(() => redis2.disconnect(), 1000)
} catch (err) {
  console.error('❌ Failed to create connection with config:', err)
}

// Method 3: What queue-worker.ts is doing
console.log('\n3. Testing queue-worker.ts approach:')
if (REDIS_URL && REDIS_PASSWORD) {
  const url = new URL(REDIS_URL)
  const redisConfig = {
    host: url.hostname,
    port: parseInt(url.port || '6379', 10),
    password: REDIS_PASSWORD, // Use password directly
  }
  console.log('Queue worker config:', { ...redisConfig, password: '***' })
  
  // This is what BullMQService receives
  const finalConfig = {
    ...redisConfig,
    maxRetriesPerRequest: null,
  }
  
  try {
    const redis3 = new Redis(finalConfig)
    redis3.on('connect', () => console.log('✅ Connected with queue worker approach'))
    redis3.on('error', (err) => console.error('❌ Error with queue worker approach:', err.message))
    setTimeout(() => redis3.disconnect(), 1000)
  } catch (err) {
    console.error('❌ Failed with queue worker approach:', err)
  }
}

// Wait for all connections to complete
setTimeout(() => process.exit(0), 2000)