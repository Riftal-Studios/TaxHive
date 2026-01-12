import { getGotenbergClient } from './gotenberg-client'

// Re-export for backward compatibility
export { uploadPDF } from './pdf-uploader'
import type { Invoice, InvoiceItem, User, Client, LUT, Payment, UnregisteredSupplier } from '@prisma/client'
import { SAC_HSN_CODES } from './constants'
import { numberToWordsIndian, numberToWordsInternational } from './utils/number-to-words'

type InvoiceWithRelations = Invoice & {
  lineItems: InvoiceItem[]
  client: Client | null  // Nullable for self-invoices
  lut: LUT | null
  payments?: Payment[]
  unregisteredSupplier?: UnregisteredSupplier | null  // For self-invoices
}

export async function generateInvoicePDF(
  invoice: InvoiceWithRelations,
  user: User
): Promise<Buffer> {
  try {
    const gotenberg = getGotenbergClient()

    // Generate HTML (existing function - unchanged)
    const html = generateInvoiceHTML(invoice, user)

    // Convert HTML to PDF using Gotenberg
    // Options match existing Puppeteer config:
    // format: 'A4' -> paperWidth: 8.27, paperHeight: 11.7
    // margin: { top: '20mm', ... } -> 20mm = 0.79 inches
    const pdfBuffer = await gotenberg.htmlToPdf(html, {
      paperWidth: 8.27,
      paperHeight: 11.7,
      marginTop: 0.79,
      marginBottom: 0.79,
      marginLeft: 0.79,
      marginRight: 0.79,
      printBackground: true,
    })

    return pdfBuffer
  } catch (error) {
    console.error('PDF generation error:', error)
    throw new Error('Failed to generate PDF: ' + (error as Error).message)
  }
}

function getServiceTypeDescription(serviceCode: string): string {
  const service = SAC_HSN_CODES.find(s => s.code === serviceCode)
  return service ? service.description : 'Professional Services'
}

function generateInvoiceHTML(invoice: InvoiceWithRelations, user: User): string {
  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const subtotalINR = Number(invoice.subtotal) * Number(invoice.exchangeRate)
  const igstAmountINR = Number(invoice.igstAmount) * Number(invoice.exchangeRate)
  const totalAmountINR = Number(invoice.totalAmount) * Number(invoice.exchangeRate)

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #333;
        }
        
        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        
        .company-details {
          flex: 1;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .invoice-title {
          text-align: right;
          flex: 1;
        }
        
        .invoice-title h1 {
          font-size: 32px;
          color: #000;
          margin-bottom: 10px;
        }
        
        .invoice-number {
          font-size: 14px;
          font-weight: bold;
        }
        
        .parties {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }
        
        .party {
          flex: 1;
        }
        
        .party h3 {
          font-size: 14px;
          margin-bottom: 10px;
          color: #666;
        }
        
        .party-details {
          line-height: 1.6;
        }
        
        .gstin {
          font-weight: bold;
          color: #000;
        }
        
        .invoice-meta {
          margin-bottom: 30px;
          padding: 15px;
          background-color: #f5f5f5;
          border: 1px solid #ddd;
        }
        
        .meta-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .meta-label {
          font-weight: bold;
          flex: 0 0 150px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        .items-table th,
        .items-table td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        
        .items-table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        
        .items-table td.number {
          text-align: right;
        }
        
        .totals {
          margin-left: auto;
          width: 400px;
          margin-bottom: 30px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        
        .total-row.grand-total {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          font-size: 16px;
          font-weight: bold;
          margin-top: 10px;
        }
        
        .lut-declaration {
          padding: 15px;
          background-color: #e8f4f8;
          border: 1px solid #b8e0ec;
          margin-bottom: 20px;
          text-align: center;
          font-weight: bold;
          color: #0066cc;
        }
        
        .exchange-rate {
          padding: 10px;
          background-color: #fff9e6;
          border: 1px solid #ffeb99;
          margin-bottom: 20px;
        }
        
        .notes {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
        }
        
        .notes h3 {
          margin-bottom: 10px;
        }
        
        .bank-details {
          margin-top: 30px;
          padding: 15px;
          background-color: #f0f8ff;
          border: 1px solid #b0d4ff;
        }
        
        .bank-details h3 {
          margin-bottom: 10px;
          color: #0066cc;
        }
        
        .bank-details p {
          white-space: pre-line;
        }
        
        .footer {
          margin-top: 50px;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
        
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="company-details">
            <div class="company-name">${user.name || 'Freelancer'}</div>
            <div class="gstin">GSTIN: ${user.gstin}</div>
            <div>PAN: ${user.pan}</div>
            <div>${user.address?.replace(/\n/g, '<br>')}</div>
            <div>Email: ${user.email}</div>
          </div>
          <div class="invoice-title">
            <h1>TAX INVOICE</h1>
            <div class="invoice-number">Invoice #${invoice.invoiceNumber}</div>
          </div>
        </div>

        <div class="parties">
          <div class="party">
            <h3>BILL TO</h3>
            <div class="party-details">
              ${invoice.client ? `
                <strong>${invoice.client.name}</strong><br>
                ${invoice.client.company ? `${invoice.client.company}<br>` : ''}
                ${invoice.client.address.replace(/\n/g, '<br>')}<br>
                ${invoice.client.country}<br>
                ${invoice.client.taxId ? `Tax ID: ${invoice.client.taxId}<br>` : ''}
                Email: ${invoice.client.email}<br>
                ${invoice.client.phone ? `Phone: ${invoice.client.phone}` : ''}
              ` : `
                <em>Self Invoice - No Client</em>
              `}
            </div>
          </div>
          <div class="party">
            <h3>INVOICE DETAILS</h3>
            <div class="party-details">
              <strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}<br>
              <strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-IN')}<br>
              <strong>Place of Supply:</strong> ${invoice.placeOfSupply}<br>
              <strong>Service Code (HSN/SAC):</strong> ${invoice.serviceCode}<br>
              <strong>Service Type:</strong> ${getServiceTypeDescription(invoice.serviceCode)}
            </div>
          </div>
        </div>

        ${invoice.lut ? `
          <div class="lut-declaration">
            SUPPLY MEANT FOR EXPORT UNDER LUT NO ${invoice.lut.lutNumber} 
            DATED ${new Date(invoice.lut.lutDate).toLocaleDateString('en-IN')} – TAX NOT PAYABLE
          </div>
        ` : ''}

        <div class="exchange-rate">
          <strong>Exchange Rate:</strong> 1 ${invoice.currency} = ${formatINR(Number(invoice.exchangeRate))} 
          (${invoice.exchangeSource} as on ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')})
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50px;">S.No</th>
              <th>Description</th>
              <th style="width: 80px;">Qty</th>
              <th style="width: 120px;">Rate (${invoice.currency})</th>
              <th style="width: 120px;">Amount (${invoice.currency})</th>
              <th style="width: 120px;">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.lineItems.map((item, index) => `
              <tr>
                <td class="number">${index + 1}</td>
                <td>${item.description}</td>
                <td class="number">${item.quantity}</td>
                <td class="number">${formatCurrency(Number(item.rate), invoice.currency)}</td>
                <td class="number">${formatCurrency(Number(item.amount), invoice.currency)}</td>
                <td class="number">${formatINR(Number(item.amount) * Number(invoice.exchangeRate))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>${formatCurrency(Number(invoice.subtotal), invoice.currency)} / ${formatINR(subtotalINR)}</span>
          </div>
          <div class="total-row">
            <span>IGST @ ${invoice.igstRate}%:</span>
            <span>${formatCurrency(Number(invoice.igstAmount), invoice.currency)} / ${formatINR(igstAmountINR)}</span>
          </div>
          <div class="total-row grand-total">
            <span>Total Amount:</span>
            <span>${formatCurrency(Number(invoice.totalAmount), invoice.currency)} / ${formatINR(totalAmountINR)}</span>
          </div>
          
          ${invoice.payments && invoice.payments.length > 0 ? `
            <div class="payments-section" style="margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
              <h4 style="margin: 10px 0;">Payment History</h4>
              ${invoice.payments.map((payment, index) => `
                <div class="total-row" style="font-size: 14px;">
                  <span>Payment ${index + 1} (${new Date(payment.paymentDate).toLocaleDateString('en-IN')}):</span>
                  <span>-${formatCurrency(Number(payment.amount), payment.currency)} / -${formatINR(Number(payment.creditedAmount || Number(payment.amount) * Number(invoice.exchangeRate)))}</span>
                </div>
              `).join('')}
              
              <div class="total-row" style="font-weight: bold; margin-top: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
                <span>Amount Paid:</span>
                <span>${formatCurrency(Number(invoice.amountPaid), invoice.currency)} / ${formatINR(Number(invoice.amountPaid) * Number(invoice.exchangeRate))}</span>
              </div>
              
              <div class="total-row grand-total" style="background-color: #f8f9fa; padding: 10px; margin-top: 10px;">
                <span>Balance Due:</span>
                <span>${formatCurrency(Number(invoice.balanceDue), invoice.currency)} / ${formatINR(Number(invoice.balanceDue) * Number(invoice.exchangeRate))}</span>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="invoice-meta">
          <div class="meta-row">
            <span class="meta-label">Amount in Words (INR):</span>
            <span>${numberToWordsIndian(totalAmountINR)} Rupees Only</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Amount in Words (${invoice.currency}):</span>
            <span>${numberToWordsInternational(Number(invoice.totalAmount))} ${getCurrencyName(invoice.currency)} Only</span>
          </div>
        </div>

        ${invoice.notes ? `
          <div class="notes">
            <h3>Notes</h3>
            <p>${invoice.notes.replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}

        ${invoice.bankDetails ? `
          <div class="bank-details">
            <h3>Bank Details</h3>
            <p>${invoice.bankDetails.replace(/\n/g, '<br>')}</p>
          </div>
        ` : ''}

        <div class="footer">
          <p>This is a computer-generated invoice and does not require a signature.</p>
          <p>Thank you for your business!</p>
        </div>
      </div>
    </body>
    </html>
  `
}


function getCurrencyName(currency: string): string {
  const names: Record<string, string> = {
    USD: 'Dollars',
    EUR: 'Euros',
    GBP: 'Pounds',
    CAD: 'Canadian Dollars',
    AUD: 'Australian Dollars',
    SGD: 'Singapore Dollars',
    AED: 'Dirhams',
  }
  return names[currency] || currency
}


// ============================================================================
// SELF INVOICE PDF GENERATION (RCM - Section 31(3)(f) CGST Act)
// ============================================================================

type SelfInvoiceWithRelations = Invoice & {
  lineItems: InvoiceItem[]
  unregisteredSupplier: UnregisteredSupplier
  paymentVoucher?: {
    voucherNumber: string
    voucherDate: Date
    paymentMode: string
    paymentReference: string | null
  } | null
}

export async function generateSelfInvoicePDF(
  invoice: SelfInvoiceWithRelations,
  user: User
): Promise<Buffer> {
  try {
    const gotenberg = getGotenbergClient()

    // Generate HTML for self-invoice
    const html = generateSelfInvoiceHTML(invoice, user)

    // Convert HTML to PDF using Gotenberg
    const pdfBuffer = await gotenberg.htmlToPdf(html, {
      paperWidth: 8.27,
      paperHeight: 11.7,
      marginTop: 0.79,
      marginBottom: 0.79,
      marginLeft: 0.79,
      marginRight: 0.79,
      printBackground: true,
    })

    return pdfBuffer
  } catch (error) {
    console.error('Self Invoice PDF generation error:', error)
    throw new Error('Failed to generate Self Invoice PDF: ' + (error as Error).message)
  }
}

function generateSelfInvoiceHTML(invoice: SelfInvoiceWithRelations, user: User): string {
  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const subtotalINR = Number(invoice.subtotal)
  const cgstAmountINR = Number(invoice.cgstAmount)
  const sgstAmountINR = Number(invoice.sgstAmount)
  const igstAmountINR = Number(invoice.igstAmount)
  const totalAmountINR = Number(invoice.totalAmount)

  // Determine if interstate (IGST) or intrastate (CGST+SGST)
  const isInterstate = Number(invoice.igstAmount) > 0

  const supplier = invoice.unregisteredSupplier

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #333;
        }

        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }

        .company-details {
          flex: 1;
        }

        .company-name {
          font-size: 22px;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .invoice-title {
          text-align: right;
          flex: 1;
        }

        .invoice-title h1 {
          font-size: 28px;
          color: #c00;
          margin-bottom: 5px;
        }

        .invoice-title .subtitle {
          font-size: 14px;
          color: #666;
          margin-bottom: 10px;
        }

        .invoice-number {
          font-size: 14px;
          font-weight: bold;
        }

        .rcm-banner {
          background-color: #fff3cd;
          border: 2px solid #ffc107;
          padding: 10px 15px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: bold;
          color: #856404;
        }

        .parties {
          display: flex;
          justify-content: space-between;
          margin-bottom: 25px;
          gap: 20px;
        }

        .party {
          flex: 1;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .party h3 {
          font-size: 12px;
          margin-bottom: 8px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .party-details {
          line-height: 1.6;
        }

        .party-details strong {
          font-size: 14px;
        }

        .gstin {
          font-weight: bold;
          color: #0066cc;
        }

        .unregistered-label {
          display: inline-block;
          background-color: #dc3545;
          color: #fff;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 3px;
          margin-top: 5px;
        }

        .invoice-meta {
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .meta-item {
          display: flex;
        }

        .meta-label {
          font-weight: bold;
          min-width: 160px;
          color: #555;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 25px;
        }

        .items-table th,
        .items-table td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }

        .items-table th {
          background-color: #e9ecef;
          font-weight: bold;
          font-size: 11px;
          text-transform: uppercase;
        }

        .items-table td.number {
          text-align: right;
        }

        .totals {
          margin-left: auto;
          width: 350px;
          margin-bottom: 25px;
        }

        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }

        .total-row.grand-total {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          font-size: 16px;
          font-weight: bold;
          margin-top: 10px;
          padding: 10px 0;
        }

        .rcm-liability {
          margin-bottom: 25px;
          padding: 15px;
          background-color: #e8f4e8;
          border: 1px solid #28a745;
          border-radius: 4px;
        }

        .rcm-liability h4 {
          color: #155724;
          margin-bottom: 10px;
        }

        .rcm-liability .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .amount-words {
          padding: 12px 15px;
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          margin-bottom: 25px;
          border-radius: 4px;
        }

        .payment-voucher-ref {
          padding: 12px 15px;
          background-color: #e7f3ff;
          border: 1px solid #b8daff;
          margin-bottom: 25px;
          border-radius: 4px;
        }

        .footer-declaration {
          margin-top: 30px;
          padding: 15px;
          background-color: #fff3cd;
          border: 1px solid #ffc107;
          text-align: center;
          font-size: 11px;
          color: #856404;
          border-radius: 4px;
        }

        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
        }

        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="company-details">
            <div class="company-name">${user.name || 'Business Name'}</div>
            <div class="gstin">GSTIN: ${user.gstin}</div>
            <div>PAN: ${user.pan}</div>
            <div>${user.address?.replace(/\n/g, '<br>') || ''}</div>
            <div>Email: ${user.email}</div>
          </div>
          <div class="invoice-title">
            <h1>SELF INVOICE</h1>
            <div class="subtitle">(Under RCM - Reverse Charge Mechanism)</div>
            <div class="invoice-number">Invoice #${invoice.invoiceNumber}</div>
          </div>
        </div>

        <div class="rcm-banner">
          TAX PAYABLE UNDER REVERSE CHARGE MECHANISM (RCM) AS PER SECTION 9(4) OF CGST ACT, 2017
        </div>

        <div class="parties">
          <div class="party">
            <h3>From (Supplier)</h3>
            <div class="party-details">
              <strong>${supplier.name}</strong><br>
              ${supplier.address.replace(/\n/g, '<br>')}<br>
              ${supplier.state} - ${supplier.stateCode}<br>
              ${supplier.pincode ? `PIN: ${supplier.pincode}<br>` : ''}
              ${supplier.pan ? `PAN: ${supplier.pan}<br>` : ''}
              ${supplier.phone ? `Phone: ${supplier.phone}<br>` : ''}
              ${supplier.email ? `Email: ${supplier.email}` : ''}
              <div class="unregistered-label">UNREGISTERED SUPPLIER</div>
            </div>
          </div>
          <div class="party">
            <h3>To (Recipient - Self)</h3>
            <div class="party-details">
              <strong>${user.name || 'Business Name'}</strong><br>
              ${user.address?.replace(/\n/g, '<br>') || ''}<br>
              <span class="gstin">GSTIN: ${user.gstin}</span><br>
              PAN: ${user.pan}<br>
              Email: ${user.email}
            </div>
          </div>
        </div>

        <div class="invoice-meta">
          <div class="meta-grid">
            <div class="meta-item">
              <span class="meta-label">Invoice Date:</span>
              <span>${new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date of Receipt:</span>
              <span>${invoice.dateOfReceiptOfSupply ? new Date(invoice.dateOfReceiptOfSupply).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Place of Supply:</span>
              <span>${supplier.state} (${supplier.stateCode})</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Supply Type:</span>
              <span>${isInterstate ? 'Inter-State (IGST)' : 'Intra-State (CGST + SGST)'}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">HSN/SAC Code:</span>
              <span>${invoice.serviceCode}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Service Type:</span>
              <span>${getServiceTypeDescription(invoice.serviceCode)}</span>
            </div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 40px;">S.No</th>
              <th>Description</th>
              <th style="width: 100px;">HSN/SAC</th>
              <th style="width: 60px;">Qty</th>
              <th style="width: 100px;">Rate (₹)</th>
              <th style="width: 120px;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.lineItems.map((item, index) => `
              <tr>
                <td class="number">${index + 1}</td>
                <td>${item.description}</td>
                <td class="number">${item.serviceCode}</td>
                <td class="number">${Number(item.quantity)}</td>
                <td class="number">${formatINR(Number(item.rate))}</td>
                <td class="number">${formatINR(Number(item.amount))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Taxable Value:</span>
            <span>${formatINR(subtotalINR)}</span>
          </div>
          ${isInterstate ? `
            <div class="total-row">
              <span>IGST @ ${Number(invoice.igstRate)}%:</span>
              <span>${formatINR(igstAmountINR)}</span>
            </div>
          ` : `
            <div class="total-row">
              <span>CGST @ ${Number(invoice.cgstRate)}%:</span>
              <span>${formatINR(cgstAmountINR)}</span>
            </div>
            <div class="total-row">
              <span>SGST @ ${Number(invoice.sgstRate)}%:</span>
              <span>${formatINR(sgstAmountINR)}</span>
            </div>
          `}
          <div class="total-row grand-total">
            <span>Total Amount:</span>
            <span>${formatINR(totalAmountINR)}</span>
          </div>
        </div>

        <div class="rcm-liability">
          <h4>RCM Tax Liability Summary (For GSTR-3B)</h4>
          <div class="row">
            <span>Total RCM Liability (Table 3.1(d)):</span>
            <span><strong>${formatINR(Number(invoice.rcmLiability))}</strong></span>
          </div>
          <div class="row">
            <span>ITC Claimable (Table 4A(3)):</span>
            <span><strong>${formatINR(Number(invoice.itcClaimable))}</strong></span>
          </div>
        </div>

        <div class="amount-words">
          <strong>Amount in Words:</strong> ${numberToWordsIndian(totalAmountINR)} Rupees Only
        </div>

        ${invoice.paymentVoucher ? `
          <div class="payment-voucher-ref">
            <strong>Payment Voucher Reference:</strong> ${invoice.paymentVoucher.voucherNumber}
            dated ${new Date(invoice.paymentVoucher.voucherDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            (${invoice.paymentVoucher.paymentMode}${invoice.paymentVoucher.paymentReference ? ` - Ref: ${invoice.paymentVoucher.paymentReference}` : ''})
          </div>
        ` : ''}

        <div class="footer-declaration">
          <strong>DECLARATION:</strong><br>
          This Self Invoice is issued under Section 31(3)(f) of the CGST Act, 2017 read with Rule 46 of the CGST Rules, 2017.<br>
          The tax on this supply is payable on reverse charge basis by the recipient (registered person) under Section 9(4) of the CGST Act, 2017.
        </div>

        <div class="footer">
          <p>This is a computer-generated self invoice issued under RCM provisions.</p>
          <p>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
    </body>
    </html>
  `
}


// ============================================================================
// PAYMENT VOUCHER PDF GENERATION
// ============================================================================

type PaymentVoucherWithRelations = {
  id: string
  voucherNumber: string
  voucherDate: Date
  supplierName: string
  supplierAddress: string
  amount: number | { toNumber?: () => number }
  paymentMode: string
  paymentReference: string | null
  notes: string | null
  selfInvoice: {
    invoiceNumber: string
    invoiceDate: Date
    totalAmount: number | { toNumber?: () => number }
  }
}

export async function generatePaymentVoucherPDF(
  voucher: PaymentVoucherWithRelations,
  user: User
): Promise<Buffer> {
  try {
    const gotenberg = getGotenbergClient()

    // Generate HTML for payment voucher
    const html = generatePaymentVoucherHTML(voucher, user)

    // Convert HTML to PDF using Gotenberg
    const pdfBuffer = await gotenberg.htmlToPdf(html, {
      paperWidth: 8.27,
      paperHeight: 11.7,
      marginTop: 0.79,
      marginBottom: 0.79,
      marginLeft: 0.79,
      marginRight: 0.79,
      printBackground: true,
    })

    return pdfBuffer
  } catch (error) {
    console.error('Payment Voucher PDF generation error:', error)
    throw new Error('Failed to generate Payment Voucher PDF: ' + (error as Error).message)
  }
}

function generatePaymentVoucherHTML(voucher: PaymentVoucherWithRelations, user: User): string {
  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const toNumber = (value: number | { toNumber?: () => number }): number => {
    if (typeof value === 'number') return value
    if (typeof value?.toNumber === 'function') return value.toNumber()
    return Number(value)
  }

  const amount = toNumber(voucher.amount)
  const invoiceTotal = toNumber(voucher.selfInvoice.totalAmount)

  const paymentModeLabels: Record<string, string> = {
    CASH: 'Cash',
    BANK_TRANSFER: 'Bank Transfer (NEFT/RTGS/IMPS)',
    CHEQUE: 'Cheque',
    UPI: 'UPI',
    DD: 'Demand Draft',
    OTHER: 'Other',
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.5;
          color: #333;
        }

        .voucher-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #000;
        }

        .company-name {
          font-size: 22px;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .company-details {
          font-size: 11px;
          color: #555;
          margin-bottom: 15px;
        }

        .voucher-title {
          font-size: 24px;
          font-weight: bold;
          color: #2c5aa0;
          margin-top: 15px;
        }

        .voucher-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding: 15px;
          background-color: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .voucher-meta-item {
          text-align: center;
        }

        .voucher-meta-label {
          font-size: 10px;
          text-transform: uppercase;
          color: #666;
        }

        .voucher-meta-value {
          font-size: 16px;
          font-weight: bold;
          color: #333;
        }

        .section {
          margin-bottom: 25px;
        }

        .section-title {
          font-size: 14px;
          font-weight: bold;
          color: #333;
          margin-bottom: 10px;
          padding-bottom: 5px;
          border-bottom: 1px solid #ddd;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 150px 1fr;
          gap: 8px;
        }

        .details-label {
          font-weight: bold;
          color: #555;
        }

        .amount-box {
          text-align: center;
          padding: 25px;
          background-color: #e8f4e8;
          border: 2px solid #28a745;
          border-radius: 8px;
          margin: 30px 0;
        }

        .amount-label {
          font-size: 14px;
          color: #155724;
          margin-bottom: 10px;
        }

        .amount-value {
          font-size: 32px;
          font-weight: bold;
          color: #155724;
        }

        .amount-words {
          font-size: 12px;
          color: #155724;
          margin-top: 10px;
          font-style: italic;
        }

        .linked-invoice {
          padding: 15px;
          background-color: #e7f3ff;
          border: 1px solid #b8daff;
          border-radius: 4px;
          margin-bottom: 25px;
        }

        .linked-invoice-title {
          font-weight: bold;
          color: #004085;
          margin-bottom: 8px;
        }

        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 50px;
          padding-top: 20px;
        }

        .signature-box {
          width: 200px;
          text-align: center;
        }

        .signature-line {
          border-top: 1px solid #333;
          padding-top: 5px;
          margin-top: 50px;
        }

        .notes-section {
          padding: 15px;
          background-color: #fff9e6;
          border: 1px solid #ffc107;
          border-radius: 4px;
          margin-bottom: 25px;
        }

        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 10px;
          color: #666;
          border-top: 1px solid #ddd;
          padding-top: 15px;
        }

        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      <div class="voucher-container">
        <div class="header">
          <div class="company-name">${user.name || 'Business Name'}</div>
          <div class="company-details">
            GSTIN: ${user.gstin} | PAN: ${user.pan}<br>
            ${user.address?.replace(/\n/g, ', ') || ''}<br>
            ${user.email}
          </div>
          <div class="voucher-title">PAYMENT VOUCHER</div>
        </div>

        <div class="voucher-meta">
          <div class="voucher-meta-item">
            <div class="voucher-meta-label">Voucher Number</div>
            <div class="voucher-meta-value">${voucher.voucherNumber}</div>
          </div>
          <div class="voucher-meta-item">
            <div class="voucher-meta-label">Voucher Date</div>
            <div class="voucher-meta-value">${new Date(voucher.voucherDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
          <div class="voucher-meta-item">
            <div class="voucher-meta-label">Payment Mode</div>
            <div class="voucher-meta-value">${paymentModeLabels[voucher.paymentMode] || voucher.paymentMode}</div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">Paid To (Supplier Details)</div>
          <div class="details-grid">
            <div class="details-label">Name:</div>
            <div>${voucher.supplierName}</div>
            <div class="details-label">Address:</div>
            <div>${voucher.supplierAddress.replace(/\n/g, ', ')}</div>
            ${voucher.paymentReference ? `
              <div class="details-label">Reference:</div>
              <div>${voucher.paymentReference}</div>
            ` : ''}
          </div>
        </div>

        <div class="linked-invoice">
          <div class="linked-invoice-title">Linked Self Invoice</div>
          <div class="details-grid">
            <div class="details-label">Invoice Number:</div>
            <div>${voucher.selfInvoice.invoiceNumber}</div>
            <div class="details-label">Invoice Date:</div>
            <div>${new Date(voucher.selfInvoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
            <div class="details-label">Invoice Amount:</div>
            <div>${formatINR(invoiceTotal)}</div>
          </div>
        </div>

        <div class="amount-box">
          <div class="amount-label">Amount Paid</div>
          <div class="amount-value">${formatINR(amount)}</div>
          <div class="amount-words">${numberToWordsIndian(amount)} Rupees Only</div>
        </div>

        ${voucher.notes ? `
          <div class="notes-section">
            <strong>Notes:</strong><br>
            ${voucher.notes.replace(/\n/g, '<br>')}
          </div>
        ` : ''}

        <div class="signatures">
          <div class="signature-box">
            <div class="signature-line">Received By (Supplier)</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Authorized Signatory</div>
          </div>
        </div>

        <div class="footer">
          <p>This payment voucher is issued in connection with Self Invoice under RCM provisions.</p>
          <p>Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
    </body>
    </html>
  `
}