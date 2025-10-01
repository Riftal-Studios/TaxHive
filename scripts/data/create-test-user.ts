import { Logger } from '../../lib/logger'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createUser() {
  try {
    const user = await prisma.user.upsert({
      where: { email: 'nasiridrishi@outlook.com' },
      update: {},
      create: {
        email: 'nasiridrishi@outlook.com',
        name: 'Nasir Idrishi',
        gstin: '29ABCDE1234F1Z5',
        pan: 'ABCDE1234F',
        address: 'Bangalore, Karnataka, India',
        onboardingCompleted: true,
      }
    })
    Logger.info('User created/found:', user.email)
  } catch (error) {
    Logger.error('Error creating user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createUser()