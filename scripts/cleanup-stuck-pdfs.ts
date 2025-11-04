#!/usr/bin/env tsx
/**
 * Cleanup Stuck PDF Generation Jobs
 *
 * This script finds invoices that have been stuck in "generating" status
 * for longer than a threshold (default: 1 hour) and resets them to "pending"
 * so they can be retried.
 *
 * Run manually: npm run cleanup:stuck-pdfs
 * Or schedule as a cron job to run every 30 minutes
 */

import { db } from '@/lib/prisma'

const STUCK_THRESHOLD_MINUTES = parseInt(process.env.STUCK_PDF_THRESHOLD_MINUTES || '60', 10)

async function cleanupStuckPDFs() {
  console.log('🔍 Checking for stuck PDF generation jobs...')
  console.log(`   Threshold: ${STUCK_THRESHOLD_MINUTES} minutes`)

  const thresholdDate = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000)

  try {
    // Find invoices stuck in "generating" status for longer than threshold
    const stuckInvoices = await db.invoice.findMany({
      where: {
        pdfStatus: 'generating',
        updatedAt: {
          lt: thresholdDate,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        pdfJobId: true,
        updatedAt: true,
      },
    })

    if (stuckInvoices.length === 0) {
      console.log('✅ No stuck PDF generation jobs found')
      return
    }

    console.log(`⚠️  Found ${stuckInvoices.length} stuck PDF generation job(s):`)
    stuckInvoices.forEach((invoice) => {
      const stuckFor = Math.floor((Date.now() - invoice.updatedAt.getTime()) / 1000 / 60)
      console.log(
        `   - Invoice ${invoice.invoiceNumber} (${invoice.id}) - stuck for ${stuckFor} minutes (job ID: ${invoice.pdfJobId})`
      )
    })

    // Reset them to pending so they can be retried
    const result = await db.invoice.updateMany({
      where: {
        id: {
          in: stuckInvoices.map((inv) => inv.id),
        },
      },
      data: {
        pdfStatus: 'pending',
        pdfJobId: null,
        pdfError: `Reset from stuck "generating" status at ${new Date().toISOString()}`,
      },
    })

    console.log(`✅ Reset ${result.count} invoice(s) to pending status`)
    console.log('   These invoices can now be retried by clicking the print/generate button')
  } catch (error) {
    console.error('❌ Failed to cleanup stuck PDF jobs:', error)
    throw error
  }
}

// Run the cleanup
cleanupStuckPDFs()
  .then(() => {
    console.log('✅ Cleanup completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Cleanup failed:', error)
    process.exit(1)
  })
