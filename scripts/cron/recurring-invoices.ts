#!/usr/bin/env tsx
/**
 * Cron job to check and generate recurring invoices
 * Run this daily at a scheduled time (e.g., 2 AM)
 * 
 * Usage:
 * - Development: npm run cron:recurring-invoices
 * - Production: Set up as a cron job or scheduled task
 */

import { checkAndGenerateRecurringInvoices } from '@/lib/queue/jobs/recurring-invoice-generation'
import { prisma } from '@/lib/db'

async function main() {
  console.log('=================================')
  console.log('Recurring Invoice Generation Cron')
  console.log(`Started at: ${new Date().toISOString()}`)
  console.log('=================================')
  
  try {
    // Check database connection
    await prisma.$connect()
    console.log('✅ Database connected')
    
    // Run the recurring invoice check
    const result = await checkAndGenerateRecurringInvoices()
    
    console.log('=================================')
    console.log('Results:')
    console.log(`- Invoices processed: ${result.processed}`)
    console.log('=================================')
    
    // Also check for subscriptions that need renewal
    await checkSubscriptionRenewals()
    
    console.log('✅ Cron job completed successfully')
  } catch (error) {
    console.error('❌ Error in recurring invoice cron job:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Check for subscriptions that need renewal
async function checkSubscriptionRenewals() {
  console.log('\nChecking for subscription renewals...')
  
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
    
    console.log(`Found ${expiredSubscriptions.length} subscriptions to renew`)
    
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
      
      console.log(`Renewed subscription ${subscription.id} until ${newPeriodEnd.toISOString()}`)
    }
    
    console.log('✅ Subscription renewals completed')
  } catch (error) {
    console.error('Error checking subscription renewals:', error)
  }
}

// Handle trial expirations
async function checkTrialExpirations() {
  console.log('\nChecking for trial expirations...')
  
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
    
    console.log(`Found ${expiredTrials.length} expired trials`)
    
    for (const subscription of expiredTrials) {
      // Update status from TRIALING to ACTIVE
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'ACTIVE',
        },
      })
      
      console.log(`Trial expired for subscription ${subscription.id}, moved to ACTIVE`)
      
      // TODO: Send notification email about trial expiration
    }
    
    console.log('✅ Trial expiration check completed')
  } catch (error) {
    console.error('Error checking trial expirations:', error)
  }
}

// Run the main function
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})