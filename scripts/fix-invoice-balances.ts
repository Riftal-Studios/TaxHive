#!/usr/bin/env tsx
/**
 * Fix invoice balance calculations
 * This script recalculates amountPaid and balanceDue for all invoices
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixInvoiceBalances() {
  try {
    console.log('Starting invoice balance fix...\n')
    
    // Get all invoices
    const invoices = await prisma.invoice.findMany({
      include: {
        payments: true,
      }
    })
    
    console.log(`Found ${invoices.length} invoices to check`)
    
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
        console.log(`\nFixing invoice ${invoice.invoiceNumber}:`)
        console.log(`  Total Amount: ${invoice.totalAmount} ${invoice.currency}`)
        console.log(`  Current Amount Paid: ${invoice.amountPaid} -> ${actualAmountPaid}`)
        console.log(`  Current Balance Due: ${invoice.balanceDue} -> ${calculatedBalanceDue}`)
        console.log(`  Payment Status: ${invoice.paymentStatus} -> ${paymentStatus}`)
        console.log(`  Number of payments: ${invoice.payments.length}`)
        
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
    
    console.log(`\n✅ Fixed ${fixedCount} invoices`)
    console.log(`✅ ${invoices.length - fixedCount} invoices were already correct`)
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Add confirmation prompt for production
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  
  if (isDryRun) {
    console.log('🔍 Running in DRY RUN mode - no changes will be made\n')
  }
  
  if (!isDryRun && process.env.NODE_ENV === 'production') {
    console.log('⚠️  WARNING: Running in production mode!')
    console.log('This will update invoice balances in the database.')
    console.log('To preview changes without updating, run with --dry-run flag')
    console.log('\nPress Ctrl+C to cancel or Enter to continue...')
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve)
    })
  }
  
  await fixInvoiceBalances()
}

main()