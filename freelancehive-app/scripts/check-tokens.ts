import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkTokens() {
  console.log('Checking verification tokens in database...\n')
  
  // Get all verification tokens
  const tokens = await prisma.verificationToken.findMany({
    orderBy: { expires: 'desc' },
  })
  
  if (tokens.length === 0) {
    console.log('No verification tokens found in database.')
  } else {
    console.log(`Found ${tokens.length} verification token(s):\n`)
    
    tokens.forEach((token, index) => {
      const isExpired = new Date(token.expires) < new Date()
      console.log(`Token ${index + 1}:`)
      console.log(`  Email: ${token.identifier}`)
      console.log(`  Token: ${token.token.substring(0, 20)}...`)
      console.log(`  Expires: ${token.expires.toLocaleString()}`)
      console.log(`  Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`)
      console.log()
    })
  }
  
  // Also check users
  console.log('\nUsers in database:')
  const users = await prisma.user.findMany({
    select: { email: true, emailVerified: true, createdAt: true },
  })
  
  users.forEach(user => {
    console.log(`- ${user.email} (Verified: ${user.emailVerified ? 'Yes' : 'No'})`)
  })
}

checkTokens()
  .catch(console.error)
  .finally(() => prisma.$disconnect())