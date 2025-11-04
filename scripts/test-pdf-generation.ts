#!/usr/bin/env tsx
/**
 * Test PDF Generation
 *
 * Queues a PDF generation job for the demo invoice and monitors its status
 */

import { getQueueService } from '@/lib/queue'

async function main() {
  const invoiceId = 'cmhj1xivr000bsegptfzdtjbq'
  const userId = 'cmhj1xiup0000segp51rive9s'

  console.log(`🚀 Queuing PDF generation for invoice ${invoiceId}...`)

  const queueService = getQueueService()

  const job = await queueService.enqueue('PDF_GENERATION', {
    invoiceId,
    userId,
  })

  console.log(`✅ Job queued successfully!`)
  console.log(`Job ID: ${job.id}`)
  console.log(`Job Status: ${job.status}`)
  console.log(`\nCheck the worker logs to see the job being processed...`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .then(() => {
    process.exit(0)
  })
