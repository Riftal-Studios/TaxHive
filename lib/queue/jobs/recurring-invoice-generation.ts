import { Job, RecurringInvoiceGenerationJobData } from '../types'
import { prisma } from '../../db'
import { Prisma } from '@prisma/client'
import { 
  addDays, 
  addWeeks, 
  addMonths, 
  addQuarters, 
  addYears,
  setDay,
  setDate,
  setMonth,
  isAfter,
  startOfDay
} from 'date-fns'
import { getQueueService } from '..'

// Helper function to calculate next run date
function calculateNextRunDate(
  frequency: string,
  interval: number,
  currentDate: Date,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null,
  monthOfYear?: number | null
): Date {
  const date = startOfDay(currentDate)
  
  switch (frequency) {
    case 'DAILY':
      return addDays(date, interval)
      
    case 'WEEKLY':
      let nextWeekly = addWeeks(date, interval)
      if (dayOfWeek !== null && dayOfWeek !== undefined) {
        nextWeekly = setDay(nextWeekly, dayOfWeek)
      }
      return nextWeekly
      
    case 'MONTHLY':
      let nextMonthly = addMonths(date, interval)
      if (dayOfMonth !== null && dayOfMonth !== undefined) {
        // Handle edge case where dayOfMonth doesn't exist in the month
        const lastDayOfMonth = new Date(nextMonthly.getFullYear(), nextMonthly.getMonth() + 1, 0).getDate()
        const effectiveDay = Math.min(dayOfMonth, lastDayOfMonth)
        nextMonthly = setDate(nextMonthly, effectiveDay)
      }
      return nextMonthly
      
    case 'QUARTERLY':
      return addQuarters(date, interval)
      
    case 'YEARLY':
      let nextYearly = addYears(date, interval)
      if (monthOfYear !== null && monthOfYear !== undefined) {
        nextYearly = setMonth(nextYearly, monthOfYear - 1) // JS months are 0-indexed
      }
      return nextYearly
      
    default:
      throw new Error(`Invalid frequency: ${frequency}`)
  }
}

// Process a single recurring invoice generation job
export async function processRecurringInvoiceGeneration(job: Job<RecurringInvoiceGenerationJobData>) {
  const { recurringInvoiceId, userId, manual } = job.data
  
  console.log(`Processing recurring invoice generation: ${recurringInvoiceId}`)
  
  try {
    // Fetch the recurring invoice with all related data
    const recurringInvoice = await prisma.recurringInvoice.findFirst({
      where: {
        id: recurringInvoiceId,
        userId,
      },
      include: {
        client: true,
        lineItems: true,
        lut: true,
      },
    })
    
    if (!recurringInvoice) {
      throw new Error('Recurring invoice not found')
    }
    
    // Check if invoice should be generated (unless manually triggered)
    if (!manual) {
      if (recurringInvoice.status !== 'ACTIVE') {
        console.log(`Skipping inactive recurring invoice: ${recurringInvoiceId}`)
        return { skipped: true, reason: 'Invoice not active' }
      }
      
      // Check if we've exceeded end date
      if (recurringInvoice.endDate && isAfter(new Date(), recurringInvoice.endDate)) {
        await prisma.recurringInvoice.update({
          where: { id: recurringInvoiceId },
          data: { status: 'COMPLETED' },
        })
        return { skipped: true, reason: 'End date reached' }
      }
      
      // Check if we've reached occurrence limit
      if (recurringInvoice.occurrences && recurringInvoice.generatedCount >= recurringInvoice.occurrences) {
        await prisma.recurringInvoice.update({
          where: { id: recurringInvoiceId },
          data: { status: 'COMPLETED' },
        })
        return { skipped: true, reason: 'Occurrence limit reached' }
      }
      
      // Check if it's time to generate (nextRunDate <= today)
      if (isAfter(recurringInvoice.nextRunDate, new Date())) {
        console.log(`Not yet time to generate invoice for: ${recurringInvoiceId}`)
        return { skipped: true, reason: 'Not yet due' }
      }
    }
    
    // Get exchange rate if needed
    let exchangeRate = new Prisma.Decimal(1)
    let exchangeSource = 'Manual'
    
    if (recurringInvoice.currency !== 'INR') {
      const latestRate = await prisma.exchangeRate.findFirst({
        where: {
          currency: recurringInvoice.currency,
        },
        orderBy: {
          date: 'desc',
        },
      })
      
      if (latestRate) {
        exchangeRate = latestRate.rate
        exchangeSource = latestRate.source
      }
    }
    
    // Calculate amounts
    const subtotal = recurringInvoice.lineItems.reduce((sum, item) => {
      return sum.add(item.quantity.mul(item.rate))
    }, new Prisma.Decimal(0))
    
    const totalInINR = subtotal.mul(exchangeRate)
    const dueDate = addDays(new Date(), recurringInvoice.paymentTerms)
    
    // Get the next invoice number
    const currentFiscalYear = new Date().getMonth() >= 3 
      ? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`
      : `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}`
    
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        userId,
        invoiceNumber: {
          startsWith: `FY${currentFiscalYear.slice(2, 4)}-${currentFiscalYear.slice(7, 9)}/`,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    })
    
    const nextNumber = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.split('/')[1]) + 1
      : 1
    
    const invoiceNumber = `FY${currentFiscalYear.slice(2, 4)}-${currentFiscalYear.slice(7, 9)}/${nextNumber.toString().padStart(3, '0')}`
    
    // Create the invoice
    const invoice = await prisma.invoice.create({
      data: {
        userId,
        clientId: recurringInvoice.clientId,
        recurringInvoiceId: recurringInvoice.id,
        invoiceNumber,
        invoiceDate: new Date(),
        dueDate,
        status: recurringInvoice.sendAutomatically ? 'SENT' : 'DRAFT',
        invoiceType: recurringInvoice.invoiceType,
        placeOfSupply: recurringInvoice.placeOfSupply || 'Outside India (Section 2-6)',
        serviceCode: recurringInvoice.serviceCode,
        lutId: recurringInvoice.lutId,
        buyerGSTIN: recurringInvoice.invoiceType === 'DOMESTIC_B2B' ? recurringInvoice.client.gstin : null,
        currency: recurringInvoice.currency,
        exchangeRate,
        exchangeSource,
        subtotal,
        taxableAmount: subtotal,
        totalAmount: subtotal,
        totalInINR,
        balanceDue: subtotal,
        paymentTerms: `Net ${recurringInvoice.paymentTerms} days`,
        lineItems: {
          create: recurringInvoice.lineItems.map(item => ({
            description: item.description,
            serviceCode: item.hsnCode,
            uqc: 'NOS',
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity.mul(item.rate),
          })),
        },
      },
      include: {
        lineItems: true,
        client: true,
      },
    })
    
    console.log(`Generated invoice ${invoice.invoiceNumber} from recurring template ${recurringInvoiceId}`)
    
    // Update recurring invoice - calculate next run date and increment count
    const nextRunDate = calculateNextRunDate(
      recurringInvoice.frequency,
      recurringInvoice.interval,
      recurringInvoice.nextRunDate,
      recurringInvoice.dayOfWeek,
      recurringInvoice.dayOfMonth,
      recurringInvoice.monthOfYear
    )
    
    const newGeneratedCount = recurringInvoice.generatedCount + 1
    const shouldComplete = recurringInvoice.occurrences && newGeneratedCount >= recurringInvoice.occurrences
    
    await prisma.recurringInvoice.update({
      where: { id: recurringInvoiceId },
      data: {
        generatedCount: newGeneratedCount,
        nextRunDate,
        status: shouldComplete ? 'COMPLETED' : recurringInvoice.status,
      },
    })
    
    // Queue PDF generation
    const queueService = getQueueService()
    await queueService.enqueue('PDF_GENERATION', {
      invoiceId: invoice.id,
      userId,
    })
    
    // Send email if configured
    if (recurringInvoice.sendAutomatically) {
      const emailData = {
        to: recurringInvoice.client.email,
        cc: recurringInvoice.ccEmails.join(','),
        subject: `Invoice ${invoice.invoiceNumber} from ${invoice.user?.name || 'Your Service Provider'}`,
        template: 'invoice',
        data: {
          invoiceNumber: invoice.invoiceNumber,
          clientName: recurringInvoice.client.name,
          amount: subtotal.toString(),
          currency: recurringInvoice.currency,
          dueDate: dueDate.toISOString(),
          customMessage: recurringInvoice.emailTemplate,
        },
        userId,
      }
      
      await queueService.enqueue('EMAIL_NOTIFICATION', emailData, {
        delay: 5000, // Wait 5 seconds for PDF to be generated
      })
    }
    
    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      nextRunDate,
    }
  } catch (error) {
    console.error('Error generating recurring invoice:', error)
    throw error
  }
}

// Cron job to check and generate all due recurring invoices
export async function checkAndGenerateRecurringInvoices() {
  console.log('Checking for recurring invoices to generate...')
  
  try {
    // Find all active recurring invoices that are due
    const dueRecurringInvoices = await prisma.recurringInvoice.findMany({
      where: {
        status: 'ACTIVE',
        nextRunDate: {
          lte: new Date(),
        },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
      select: {
        id: true,
        userId: true,
      },
    })
    
    console.log(`Found ${dueRecurringInvoices.length} recurring invoices to generate`)
    
    if (dueRecurringInvoices.length === 0) {
      return { processed: 0 }
    }
    
    // Queue generation jobs for each due invoice
    const queueService = getQueueService()
    const jobs = []
    
    for (const recurring of dueRecurringInvoices) {
      const job = await queueService.enqueue('RECURRING_INVOICE_GENERATION', {
        recurringInvoiceId: recurring.id,
        userId: recurring.userId,
        manual: false,
      })
      jobs.push(job)
    }
    
    console.log(`Queued ${jobs.length} recurring invoice generation jobs`)
    
    return {
      processed: jobs.length,
      jobIds: jobs.map(j => j.id),
    }
  } catch (error) {
    console.error('Error checking recurring invoices:', error)
    throw error
  }
}