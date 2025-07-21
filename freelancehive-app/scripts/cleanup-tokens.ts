import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanup() {
  console.log('Cleaning up verification tokens...\n')
  
  // Delete all verification tokens for the email
  const deleted = await prisma.verificationToken.deleteMany({
    where: {
      identifier: 'nasiridrishi@outlook.com'
    }
  })
  
  console.log(`Deleted ${deleted.count} verification tokens`)
  
  // Show remaining tokens
  const remaining = await prisma.verificationToken.count()
  console.log(`Remaining tokens in database: ${remaining}`)
}

cleanup()
  .catch(console.error)
  .finally(() => prisma.$disconnect())