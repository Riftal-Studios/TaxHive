#!/usr/bin/env tsx
/**
 * PDF Queue Health Check
 *
 * This script performs health checks on the PDF generation queue:
 * 1. Checks for invoices stuck in "generating" status
 * 2. Verifies that jobIds in database actually exist in Redis
 * 3. Resets orphaned jobs (database says generating but job doesn't exist)
 * 4. Reports on queue statistics
 *
 * This should be run periodically (e.g., every 30 minutes) via cron
 */

import { db } from '@/lib/prisma'
import { getQueueService, isQueueServiceAvailable } from '@/lib/queue'

const STUCK_THRESHOLD_MINUTES = parseInt(process.env.STUCK_PDF_THRESHOLD_MINUTES || '60', 10)
const DRY_RUN = process.env.DRY_RUN === 'true'

interface HealthCheckResult {
  stuckInvoices: number
  orphanedJobs: number
  pendingInvoices: number
  generatingInvoices: number
  queueStats?: {
    pending: number
    active: number
    completed: number
    failed: number
  }
}

async function performHealthCheck(): Promise<HealthCheckResult> {
  console.log('🏥 PDF Queue Health Check')
  console.log(`   Stuck threshold: ${STUCK_THRESHOLD_MINUTES} minutes`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will reset stuck jobs)'}`)
  console.log('')

  const result: HealthCheckResult = {
    stuckInvoices: 0,
    orphanedJobs: 0,
    pendingInvoices: 0,
    generatingInvoices: 0,
  }

  // 1. Check queue service availability
  if (!isQueueServiceAvailable()) {
    console.warn('⚠️  Queue service is not available - skipping queue checks')
  } else {
    const queueService = getQueueService()
    const stats = await queueService.getStats()
    result.queueStats = stats
    console.log('📊 Queue Statistics:')
    console.log(`   Pending: ${stats.pending}`)
    console.log(`   Active: ${stats.active}`)
    console.log(`   Completed: ${stats.completed}`)
    console.log(`   Failed: ${stats.failed}`)
    console.log('')
  }

  // 2. Check for invoices stuck in generating status
  const thresholdDate = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000)
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

  result.stuckInvoices = stuckInvoices.length

  if (stuckInvoices.length > 0) {
    console.log(`⚠️  Found ${stuckInvoices.length} stuck invoice(s):`)
    stuckInvoices.forEach((invoice) => {
      const stuckFor = Math.floor((Date.now() - invoice.updatedAt.getTime()) / 1000 / 60)
      console.log(
        `   - ${invoice.invoiceNumber} (${invoice.id}) - stuck for ${stuckFor}min (job: ${invoice.pdfJobId})`
      )
    })

    if (!DRY_RUN) {
      console.log('   Resetting stuck invoices to pending...')
      await db.invoice.updateMany({
        where: {
          id: {
            in: stuckInvoices.map((inv) => inv.id),
          },
        },
        data: {
          pdfStatus: 'pending',
          pdfJobId: null,
          pdfError: `Auto-reset from stuck status at ${new Date().toISOString()}`,
        },
      })
      console.log('   ✅ Reset completed')
    } else {
      console.log('   [DRY RUN] Would reset these invoices to pending')
    }
    console.log('')
  }

  // 3. Check for orphaned jobs (database has jobId but job doesn't exist in queue)
  if (isQueueServiceAvailable()) {
    const queueService = getQueueService()
    const generatingInvoices = await db.invoice.findMany({
      where: {
        pdfStatus: 'generating',
        pdfJobId: {
          not: null,
        },
      },
      select: {
        id: true,
        invoiceNumber: true,
        pdfJobId: true,
      },
    })

    result.generatingInvoices = generatingInvoices.length

    const orphanedInvoices = []
    for (const invoice of generatingInvoices) {
      if (!invoice.pdfJobId) continue

      const job = await queueService.getJob(invoice.pdfJobId)
      if (!job) {
        orphanedInvoices.push(invoice)
      }
    }

    result.orphanedJobs = orphanedInvoices.length

    if (orphanedInvoices.length > 0) {
      console.log(`⚠️  Found ${orphanedInvoices.length} orphaned job(s) (database has jobId but job doesn't exist):`)
      orphanedInvoices.forEach((invoice) => {
        console.log(`   - ${invoice.invoiceNumber} (${invoice.id}) - job ${invoice.pdfJobId}`)
      })

      if (!DRY_RUN) {
        console.log('   Resetting orphaned invoices to pending...')
        await db.invoice.updateMany({
          where: {
            id: {
              in: orphanedInvoices.map((inv) => inv.id),
            },
          },
          data: {
            pdfStatus: 'pending',
            pdfJobId: null,
            pdfError: `Auto-reset: job not found in queue at ${new Date().toISOString()}`,
          },
        })
        console.log('   ✅ Reset completed')
      } else {
        console.log('   [DRY RUN] Would reset these invoices to pending')
      }
      console.log('')
    }
  }

  // 4. Count pending invoices
  result.pendingInvoices = await db.invoice.count({
    where: {
      pdfStatus: 'pending',
    },
  })

  if (result.pendingInvoices > 0) {
    console.log(`📋 ${result.pendingInvoices} invoice(s) in pending status (ready to be generated)`)
    console.log('')
  }

  // 5. Summary
  console.log('📝 Health Check Summary:')
  console.log(`   Stuck invoices reset: ${result.stuckInvoices}`)
  console.log(`   Orphaned jobs reset: ${result.orphanedJobs}`)
  console.log(`   Pending invoices: ${result.pendingInvoices}`)
  console.log(`   Generating invoices: ${result.generatingInvoices}`)

  return result
}

// Run the health check
performHealthCheck()
  .then((result) => {
    if (result.stuckInvoices > 0 || result.orphanedJobs > 0) {
      console.log('\n⚠️  Health check found issues that were ' + (DRY_RUN ? 'identified' : 'fixed'))
      process.exit(1)
    } else {
      console.log('\n✅ Health check passed - no issues found')
      process.exit(0)
    }
  })
  .catch((error) => {
    console.error('\n❌ Health check failed:', error)
    process.exit(1)
  })
