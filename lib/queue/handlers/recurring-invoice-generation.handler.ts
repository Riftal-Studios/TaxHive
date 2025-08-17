import { Job, RecurringInvoiceGenerationJobData } from '../types'
import { processRecurringInvoiceGeneration } from '../jobs/recurring-invoice-generation'

export async function recurringInvoiceGenerationHandler(job: Job<RecurringInvoiceGenerationJobData>) {
  return processRecurringInvoiceGeneration(job)
}