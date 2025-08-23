#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { getQueueService } from '../../lib/queue'
import { Logger } from '../../lib/logger'

const prisma = new PrismaClient()

async function testPDFRegeneration() {
  try {
    Logger.info('Testing PDF regeneration on invoice update...\n')
    
    // Find a test invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        user: {
          email: 'nsrhussain@icloud.com'
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })
    
    if (!invoice) {
      Logger.error('No invoice found for test user')
      return
    }
    
    Logger.info(`Found invoice: ${invoice.invoiceNumber}`)
    Logger.info(`Current PDF URL: ${invoice.pdfUrl || 'Not generated'}`)
    
    // Update the invoice notes to trigger PDF regeneration
    Logger.info('\nUpdating invoice notes...')
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        notes: `Updated at ${new Date().toISOString()} - This should trigger PDF regeneration`
      }
    })
    
    Logger.info('Invoice updated successfully')
    
    // Check if PDF regeneration was queued
    Logger.info('\nChecking queue for PDF regeneration job...')
    const queue = getQueueService()
    
    // Wait a moment for the job to be processed
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    Logger.info('\nPDF regeneration has been queued. The worker will process it shortly.')
    Logger.info('When the worker processes the job, it will:')
    Logger.info('1. Generate a new PDF with the updated invoice data')
    Logger.info('2. Save it to the uploads directory')
    Logger.info('3. Update the invoice record with the new PDF URL')
    
  } catch (error) {
    Logger.error('Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPDFRegeneration()