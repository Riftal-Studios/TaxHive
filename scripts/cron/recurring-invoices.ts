#!/usr/bin/env tsx
/**
 * Cron job to check and generate recurring invoices
 * Run this daily at a scheduled time (e.g., 2 AM)
 * 
 * Usage:
 * - Development: npm run cron:recurring-invoices
 * - Production: Set up as a cron job or scheduled task
 */

import { Logger } from '@/lib/logger'
import { checkAndGenerateRecurringInvoices } from '@/lib/queue/jobs/recurring-invoice-generation'
import { prisma } from '@/lib/db'

async function main() {
  Logger.info('=================================')
  Logger.info('Recurring Invoice Generation Cron')
  Logger.info(`Started at: ${new Date().toISOString()}`)
  Logger.info('=================================')
  
  try {
    // Check database connection
    await prisma.$connect()
    Logger.info('✅ Database connected')
    
    // Run the recurring invoice check
    const result = await checkAndGenerateRecurringInvoices()
    
    Logger.info('=================================')
    Logger.info('Results:')
    Logger.info(`- Invoices processed: ${result.processed}`)
    Logger.info('=================================')
    
    // Also check for subscriptions that need renewal
    await checkSubscriptionRenewals()
    
    Logger.info('✅ Cron job completed successfully')
  } catch (error) {
    Logger.error('❌ Error in recurring invoice cron job:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Check for subscriptions that need renewal
async function checkSubscriptionRenewals() {
  Logger.info('\nChecking for subscription renewals...')
  
  try {
    // Find subscriptions where current period has ended
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: {
          lte: new Date(),
        },
      },
    })
    
    Logger.info(`Found ${expiredSubscriptions.length} subscriptions to renew`)
    
    for (const subscription of expiredSubscriptions) {
      // Update the subscription period
      let newPeriodEnd = new Date(subscription.currentPeriodEnd)
      
      switch (subscription.billingCycle) {
        case 'MONTHLY':
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1)
          break
        case 'QUARTERLY':
          newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 3)
          break
        case 'YEARLY':
          newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1)
          break
      }
      
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          currentPeriodStart: subscription.currentPeriodEnd,
          currentPeriodEnd: newPeriodEnd,
        },
      })
      
      // If there's an associated recurring invoice, trigger generation
      if (subscription.recurringInvoiceId) {
        const { getQueueService } = await import('@/lib/queue')
        const queueService = getQueueService()
        
        await queueService.enqueue('RECURRING_INVOICE_GENERATION', {
          recurringInvoiceId: subscription.recurringInvoiceId,
          userId: subscription.userId,
          manual: false,
        })
      }
      
      Logger.info(`Renewed subscription ${subscription.id} until ${newPeriodEnd.toISOString()}`)
    }
    
    Logger.info('✅ Subscription renewals completed')
  } catch (error) {
    Logger.error('Error checking subscription renewals:', error)
  }
}

// Handle trial expirations
async function checkTrialExpirations() {
  Logger.info('\nChecking for trial expirations...')
  
  try {
    // Find subscriptions where trial has ended
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEnd: {
          lte: new Date(),
        },
      },
    })
    
    Logger.info(`Found ${expiredTrials.length} expired trials`)
    
    for (const subscription of expiredTrials) {
      // Update status from TRIALING to ACTIVE
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
        },
      })
      
      Logger.info(`Trial expired for subscription ${subscription.id}, moved to ACTIVE`)
      
      // TODO: Send notification email about trial expiration
    }
    
    Logger.info('✅ Trial expiration check completed')
  } catch (error) {
    Logger.error('Error checking trial expirations:', error)
  }
}

// Run the main function
main().catch((error) => {
  Logger.error('Fatal error:', error)
  process.exit(1)
})