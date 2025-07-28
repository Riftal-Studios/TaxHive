import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function testAuthFlow() {
  const testEmail = 'test-auth@example.com'
  
  console.log('🧪 Testing authentication flow...\n')
  
  // 1. Create a test verification token
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  
  console.log('1. Creating verification token:')
  const verificationToken = await prisma.verificationToken.create({
    data: {
      identifier: testEmail,
      token: token,
      expires: expires,
    },
  })
  console.log(`   ✅ Token created for ${testEmail}`)
  console.log(`   Token: ${token.substring(0, 20)}...`)
  console.log(`   Expires: ${expires.toLocaleString()}\n`)
  
  // 2. Simulate token lookup (what happens when clicking magic link)
  console.log('2. Looking up token:')
  const foundToken = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: testEmail,
        token: token,
      },
    },
  })
  console.log(`   ${foundToken ? '✅ Token found' : '❌ Token NOT found'}\n`)
  
  // 3. Check what happens with URL encoding
  console.log('3. Testing email encoding issues:')
  const emailWithInvisibleChar: string = 'nasiridrishi@outlook\u200B.com' // Zero-width space
  const normalEmail: string = 'nasiridrishi@outlook.com'
  
  console.log(`   Normal email: "${normalEmail}"`)
  console.log(`   Email with invisible char: "${emailWithInvisibleChar}"`)
  console.log(`   Are they equal? ${normalEmail === emailWithInvisibleChar ? 'Yes' : 'No'}\n`)
  
  // 4. URL decode test
  const encodedEmailWithIssue = 'nasiridrishi%40outlook%E2%80%8B.com'
  const decodedEmail = decodeURIComponent(encodedEmailWithIssue)
  console.log(`   Encoded email from URL: ${encodedEmailWithIssue}`)
  console.log(`   Decoded email: "${decodedEmail}"`)
  console.log(`   Decoded length: ${decodedEmail.length} (should be 23 for normal email)`)
  console.log(`   Normal email length: ${normalEmail.length}\n`)
  
  // 5. Check current tokens in database
  console.log('4. Current verification tokens:')
  const allTokens = await prisma.verificationToken.findMany()
  allTokens.forEach((t: any) => {
    console.log(`   - ${t.identifier} (expires: ${t.expires.toLocaleString()})`)
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
  console.log('\n✅ Test completed and cleaned up')
}

testAuthFlow()
  .catch(console.error)
  .finally(() => prisma.$disconnect())