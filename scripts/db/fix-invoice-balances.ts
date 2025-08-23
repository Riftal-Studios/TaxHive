#!/usr/bin/env tsx
/**
 * Fix invoice balance calculations
 * This script recalculates amountPaid and balanceDue for all invoices
 */

import { Logger } from '../../lib/logger'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixInvoiceBalances() {
  try {
    Logger.info('Starting invoice balance fix...\n')
    
    // Get all invoices
    const invoices = await prisma.invoice.findMany({
      include: {
        payments: true,
      }
    })
    
    Logger.info(`Found ${invoices.length} invoices to check`)
    
    let fixedCount = 0
    
    for (const invoice of invoices) {
      // Calculate actual amount paid from payments
      const actualAmountPaid = invoice.payments.reduce((sum, payment) => {
        return sum + Number(payment.amount)
      }, 0)
      
      // Calculate what balance due should be
      const calculatedBalanceDue = Number(invoice.totalAmount) - actualAmountPaid
      
      // Determine payment status
      let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' = 'UNPAID'
      if (actualAmountPaid >= Number(invoice.totalAmount)) {
        paymentStatus = 'PAID'
      } else if (actualAmountPaid > 0) {
        paymentStatus = 'PARTIAL'
      }
      
      // Check if update is needed
      const needsUpdate = 
        Math.abs(Number(invoice.amountPaid) - actualAmountPaid) > 0.01 ||
        Math.abs(Number(invoice.balanceDue) - calculatedBalanceDue) > 0.01 ||
        invoice.paymentStatus !== paymentStatus
      
      if (needsUpdate) {
        Logger.info(`\nFixing invoice ${invoice.invoiceNumber}:`)
        Logger.info(`  Total Amount: ${invoice.totalAmount} ${invoice.currency}`)
        Logger.info(`  Current Amount Paid: ${invoice.amountPaid} -> ${actualAmountPaid}`)
        Logger.info(`  Current Balance Due: ${invoice.balanceDue} -> ${calculatedBalanceDue}`)
        Logger.info(`  Payment Status: ${invoice.paymentStatus} -> ${paymentStatus}`)
        Logger.info(`  Number of payments: ${invoice.payments.length}`)
        
        // Update the invoice
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            amountPaid: actualAmountPaid,
            balanceDue: calculatedBalanceDue,
            paymentStatus: paymentStatus,
          }
        })
        
        fixedCount++
      }
    }
    
    Logger.info(`\n✅ Fixed ${fixedCount} invoices`)
    Logger.info(`✅ ${invoices.length - fixedCount} invoices were already correct`)
    
  } catch (error) {
    Logger.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Add confirmation prompt for production
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  
  if (isDryRun) {
    Logger.info('🔍 Running in DRY RUN mode - no changes will be made\n')
  }
  
  if (!isDryRun && process.env.NODE_ENV === 'production') {
    Logger.info('⚠️  WARNING: Running in production mode!')
    Logger.info('This will update invoice balances in the database.')
    Logger.info('To preview changes without updating, run with --dry-run flag')
    Logger.info('\nPress Ctrl+C to cancel or Enter to continue...')
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve)
    })
  }
  
  await fixInvoiceBalances()
}

main()