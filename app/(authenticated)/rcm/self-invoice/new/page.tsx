import React from 'react'
import { SelfInvoiceForm } from '@/components/rcm/self-invoice-form-simple'

export default function NewSelfInvoicePage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Create Self-Invoice</h1>
      <SelfInvoiceForm />
    </div>
  )
}