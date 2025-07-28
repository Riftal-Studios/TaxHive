import puppeteer from 'puppeteer'

// Re-export for backward compatibility
export { uploadPDF } from './pdf-uploader'
import type { Invoice, InvoiceItem, User, Client, LUT } from '@/types/prisma-temp'
import { SAC_HSN_CODES } from './constants'
import { numberToWordsIndian, numberToWordsInternational } from './utils/number-to-words'

type InvoiceWithRelations = Invoice & {
  lineItems: InvoiceItem[]
  client: Client
  lut: LUT | null
}

export async function generateInvoicePDF(
  invoice: InvoiceWithRelations,
  user: User
): Promise<Buffer> {
  let browser
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    
    const page = await browser.newPage()
    const html = generateInvoiceHTML(invoice, user)
    
    await page.setContent(html, { waitUntil: 'networkidle0' })
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm',
      },
    })
    
    await page.close()
    return Buffer.from(pdf)
  } catch (error) {
    console.error('PDF generation error:', error)
    throw new Error('Failed to generate PDF: ' + (error as Error).message)
  } finally {
    if (browser) {
      await browser.close()
    }
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
              <strong>${invoice.client.name}</strong><br>
              ${invoice.client.company ? `${invoice.client.company}<br>` : ''}
              ${invoice.client.address.replace(/\n/g, '<br>')}<br>
              ${invoice.client.country}<br>
              ${invoice.client.taxId ? `Tax ID: ${invoice.client.taxId}<br>` : ''}
              Email: ${invoice.client.email}<br>
              ${invoice.client.phone ? `Phone: ${invoice.client.phone}` : ''}
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
            ${invoice.lineItems.map((item: any, index: number) => `
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