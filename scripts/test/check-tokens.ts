import { PrismaClient } from '@prisma/client'
import { Logger } from '../../lib/logger'

const prisma = new PrismaClient()

async function checkTokens() {
  Logger.info('Checking verification tokens in database...\n')
  
  // Get all verification tokens
  const tokens = await prisma.verificationToken.findMany({
    orderBy: { expires: 'desc' },
  })
  
  if (tokens.length === 0) {
    Logger.info('No verification tokens found in database.')
  } else {
    Logger.info(`Found ${tokens.length} verification token(s):\n`)
    
    tokens.forEach((token, index) => {
      const isExpired = new Date(token.expires) < new Date()
      Logger.info(`Token ${index + 1}:`)
      Logger.info(`  Email: ${token.identifier}`)
      Logger.info(`  Token: ${token.token.substring(0, 20)}...`)
      Logger.info(`  Expires: ${token.expires.toLocaleString()}`)
      Logger.info(`  Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`)
      Logger.info('')
    })
  }
  
  // Also check users
  Logger.info('\nUsers in database:')
  const users = await prisma.user.findMany({
    select: { email: true, emailVerified: true, createdAt: true },
  })
  
  users.forEach(user => {
    Logger.info(`- ${user.email} (Verified: ${user.emailVerified ? 'Yes' : 'No'})`)
  })
}

checkTokens()
  .catch(Logger.error)
  .finally(() => prisma.$disconnect())