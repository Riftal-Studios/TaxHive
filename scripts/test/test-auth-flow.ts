import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import { Logger } from '../../lib/logger'

const prisma = new PrismaClient()

async function testAuthFlow() {
  const testEmail = 'test-auth@example.com'
  
  Logger.info('🧪 Testing authentication flow...\n')
  
  // 1. Create a test verification token
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  
  Logger.info('1. Creating verification token:')
  const verificationToken = await prisma.verificationToken.create({
    data: {
      identifier: testEmail,
      token: token,
      expires: expires,
    },
  })
  Logger.info(`   ✅ Token created for ${testEmail}`)
  Logger.info(`   Token: ${token.substring(0, 20)}...`)
  Logger.info(`   Expires: ${expires.toLocaleString()}\n`)
  
  // 2. Simulate token lookup (what happens when clicking magic link)
  Logger.info('2. Looking up token:')
  const foundToken = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: testEmail,
        token: token,
      },
    },
  })
  Logger.info(`   ${foundToken ? '✅ Token found' : '❌ Token NOT found'}\n`)
  
  // 3. Check what happens with URL encoding
  Logger.info('3. Testing email encoding issues:')
  const emailWithInvisibleChar: string = 'nasiridrishi@outlook\u200B.com' // Zero-width space
  const normalEmail: string = 'nasiridrishi@outlook.com'
  
  Logger.info(`   Normal email: "${normalEmail}"`)
  Logger.info(`   Email with invisible char: "${emailWithInvisibleChar}"`)
  Logger.info(`   Are they equal? ${normalEmail === emailWithInvisibleChar ? 'Yes' : 'No'}\n`)
  
  // 4. URL decode test
  const encodedEmailWithIssue = 'nasiridrishi%40outlook%E2%80%8B.com'
  const decodedEmail = decodeURIComponent(encodedEmailWithIssue)
  Logger.info(`   Encoded email from URL: ${encodedEmailWithIssue}`)
  Logger.info(`   Decoded email: "${decodedEmail}"`)
  Logger.info(`   Decoded length: ${decodedEmail.length} (should be 23 for normal email)`)
  Logger.info(`   Normal email length: ${normalEmail.length}\n`)
  
  // 5. Check current tokens in database
  Logger.info('4. Current verification tokens:')
  const allTokens = await prisma.verificationToken.findMany()
  allTokens.forEach(t => {
    Logger.info(`   - ${t.identifier} (expires: ${t.expires.toLocaleString()})`)
  })
  
  // Cleanup test token
  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: testEmail,
        token: token,
      },
    },
  })
  Logger.info('\n✅ Test completed and cleaned up')
}

testAuthFlow()
  .catch(Logger.error)
  .finally(() => prisma.$disconnect())