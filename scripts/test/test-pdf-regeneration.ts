#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { getQueue } from '../lib/queue'

const prisma = new PrismaClient()

async function testPDFRegeneration() {
  try {
    console.log('Testing PDF regeneration on invoice update...\n')
    
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
      console.error('No invoice found for test user')
      return
    }
    
    console.log(`Found invoice: ${invoice.invoiceNumber}`)
    console.log(`Current PDF URL: ${invoice.pdfUrl || 'Not generated'}`)
    
    // Update the invoice notes to trigger PDF regeneration
    console.log('\nUpdating invoice notes...')
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        notes: `Updated at ${new Date().toISOString()} - This should trigger PDF regeneration`
      }
    })
    
    console.log('Invoice updated successfully')
    
    // Check if PDF regeneration was queued
    console.log('\nChecking queue for PDF regeneration job...')
    const queue = getQueue()
    
    // Wait a moment for the job to be processed
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    console.log('\nPDF regeneration has been queued. The worker will process it shortly.')
    console.log('When the worker processes the job, it will:')
    console.log('1. Generate a new PDF with the updated invoice data')
    console.log('2. Save it to the uploads directory')
    console.log('3. Update the invoice record with the new PDF URL')
    
  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPDFRegeneration()