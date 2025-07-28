// Temporary Prisma type definitions to fix TypeScript errors
// This file should be removed once Prisma client generation is working

import { Decimal } from '@prisma/client/runtime/library'

export interface User {
  id: string
  email: string
  emailVerified?: Date | null
  password?: string | null
  name?: string | null
  gstin?: string | null
  pan?: string | null
  address?: string | null
  onboardingCompleted: boolean
  onboardingStep?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Client {
  id: string
  userId: string
  name: string
  email: string
  company?: string | null
  address: string
  country: string
  phone?: string | null
  taxId?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Invoice {
  id: string
  userId: string
  clientId: string
  invoiceNumber: string
  invoiceDate: Date
  dueDate: Date
  status: string
  placeOfSupply: string
  serviceCode: string
  lutId?: string | null
  currency: string
  exchangeRate: Decimal
  exchangeSource: string
  subtotal: Decimal
  igstRate: Decimal
  igstAmount: Decimal
  totalAmount: Decimal
  totalInINR: Decimal
  paymentStatus: string
  amountPaid: Decimal
  balanceDue: Decimal
  description?: string | null
  paymentTerms?: string | null
  bankDetails?: string | null
  notes?: string | null
  pdfUrl?: string | null
  createdAt: Date
  updatedAt: Date
  lineItems: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoiceId: string
  description: string
  quantity: Decimal
  rate: Decimal
  amount: Decimal
  serviceCode: string
}

export interface LUT {
  id: string
  userId: string
  lutNumber: string
  lutDate: Date
  validFrom: Date
  validTill: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Payment {
  id: string
  invoiceId: string
  amount: Decimal
  currency: string
  paymentDate: Date
  paymentMethod: string
  reference?: string | null
  notes?: string | null
  amountReceivedBeforeFees?: Decimal | null
  platformFeesInCurrency?: Decimal | null
  creditedAmount?: Decimal | null
  actualExchangeRate?: Decimal | null
  bankChargesInr?: Decimal | null
  fircNumber?: string | null
  fircDate?: Date | null
  fircDocumentUrl?: string | null
  createdAt: Date
}

export interface ExchangeRate {
  id: string
  currency: string
  rate: Decimal
  source: string
  date: Date
  createdAt: Date
}