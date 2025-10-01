/**
 * Service Layer Index
 * 
 * Exports all service instances for use throughout the application.
 * Services encapsulate business logic and data access, keeping routers thin.
 */

export { invoiceService } from './invoice.service'
export type { 
  CreateInvoiceInput, 
  UpdateInvoiceInput, 
  InvoiceFilter, 
  InvoiceWithRelations 
} from './invoice.service'

export { clientService } from './client.service'
export type { 
  CreateClientInput, 
  UpdateClientInput, 
  ClientFilter, 
  ClientWithPortalAccess 
} from './client.service'

// Export future services here as they are created
// export { paymentService } from './payment.service'
// export { gstReturnService } from './gst-return.service'
// export { reportService } from './report.service'
// export { exchangeRateService } from './exchange-rate.service'
// export { lutService } from './lut.service'
// export { emailService } from './email.service'