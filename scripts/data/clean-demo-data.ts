#!/usr/bin/env tsx
/**
 * Clean existing demo data before re-seeding
 */

import { Logger } from '../../lib/logger'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  Logger.info('🧹 Cleaning existing demo data...')

  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@gsthive.com' },
  })

  if (demoUser) {
    // Delete all related data (cascade will handle related records)
    await prisma.user.delete({
      where: { id: demoUser.id },
    })
    Logger.info('✅ Removed existing demo user and all related data')
  } else {
    Logger.info('ℹ️  No existing demo user found')
  }
}

main()
  .catch((e) => {
    Logger.error('❌ Error cleaning demo data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })