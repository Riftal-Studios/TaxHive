#!/usr/bin/env tsx
/**
 * Clean existing demo data before re-seeding
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🧹 Cleaning existing demo data...')

  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@taxhive.app' },
  })

  if (demoUser) {
    // Delete all related data (cascade will handle related records)
    await prisma.user.delete({
      where: { id: demoUser.id },
    })
    console.log('✅ Removed existing demo user and all related data')
  } else {
    console.log('ℹ️  No existing demo user found')
  }
}

main()
  .catch((e) => {
    console.error('❌ Error cleaning demo data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })