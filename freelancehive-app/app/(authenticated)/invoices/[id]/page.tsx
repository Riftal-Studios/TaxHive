import { api } from '@/lib/trpc/server'
import { notFound } from 'next/navigation'
import { InvoiceActions } from '@/components/invoice-actions'

export default async function InvoicePage({ params }: { params: { id: string } }) {
  const invoice = await api.invoices.getById.query({ id: params.id })
  
  if (!invoice) {
    notFound()
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Invoice #{invoice.invoiceNumber}
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Created on {new Date(invoice.createdAt).toLocaleDateString()}
            </p>
          </div>
          <InvoiceActions 
            invoiceId={invoice.id} 
            invoiceNumber={invoice.invoiceNumber} 
          />
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            {/* Invoice Header */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Bill To</h3>
                <div className="text-gray-600">
                  <p className="font-medium">{invoice.client.name}</p>
                  {invoice.client.company && <p>{invoice.client.company}</p>}
                  <p className="whitespace-pre-line">{invoice.client.address}</p>
                  <p>{invoice.client.country}</p>
                  {invoice.client.taxId && <p>Tax ID: {invoice.client.taxId}</p>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-600 space-y-1">
                  <p>
                    <span className="font-medium">Invoice Date:</span>{' '}
                    {new Date(invoice.issueDate).toLocaleDateString()}
                  </p>
                  <p>
                    <span className="font-medium">Due Date:</span>{' '}
                    {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                  <p>
                    <span className="font-medium">Status:</span>{' '}
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                      invoice.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {invoice.status}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* GST Information */}
            <div className="border-y border-gray-200 py-4 mb-8">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Place of Supply:</span>{' '}
                  <span className="text-gray-900">{invoice.placeOfSupply}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Service Code:</span>{' '}
                  <span className="text-gray-900">{invoice.serviceCode}</span>
                </div>
                {invoice.lut && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">LUT:</span>{' '}
                    <span className="text-gray-900">
                      {invoice.lut.lutNumber} (Valid till{' '}
                      {new Date(invoice.lut.validUntil).toLocaleDateString()})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Exchange Rate */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-8">
              <p className="text-sm font-medium text-yellow-800">
                Exchange Rate: 1 {invoice.currency} = {formatINR(Number(invoice.exchangeRate))}
                <span className="ml-2 text-yellow-600">
                  ({invoice.exchangeRateSource} as on{' '}
                  {new Date(invoice.issueDate).toLocaleDateString()})
                </span>
              </p>
            </div>

            {/* Line Items */}
            <div className="mb-8">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount ({invoice.currency})
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount (INR)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.lineItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {item.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatCurrency(Number(item.rate), invoice.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatCurrency(Number(item.amount), invoice.currency)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">
                        {formatINR(Number(item.amount) * Number(invoice.exchangeRate))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-96">
                <div className="border-t border-gray-200 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">
                      {formatCurrency(Number(invoice.subtotal), invoice.currency)} /{' '}
                      {formatINR(Number(invoice.subtotal) * Number(invoice.exchangeRate))}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IGST @ {invoice.igstRate}%:</span>
                    <span className="text-gray-900">
                      {formatCurrency(Number(invoice.igstAmount), invoice.currency)} /{' '}
                      {formatINR(Number(invoice.igstAmount) * Number(invoice.exchangeRate))}
                    </span>
                  </div>
                  <div className="flex justify-between text-lg font-medium border-t pt-2">
                    <span>Total:</span>
                    <span>
                      {formatCurrency(Number(invoice.totalAmount), invoice.currency)} /{' '}
                      {formatINR(Number(invoice.totalAmount) * Number(invoice.exchangeRate))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-8 border-t border-gray-200 pt-8">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Notes</h3>
                <p className="text-sm text-gray-600 whitespace-pre-line">
                  {invoice.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}