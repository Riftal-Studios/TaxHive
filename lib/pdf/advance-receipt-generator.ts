import puppeteer from 'puppeteer'
import type { AdvanceReceipt, Client, User } from '@prisma/client'
import { numberToWordsIndian } from '../utils/number-to-words'
import { format } from 'date-fns'

type AdvanceReceiptWithRelations = AdvanceReceipt & {
  client: Client
}

export async function generateAdvanceReceiptPDF(
  receipt: AdvanceReceiptWithRelations,
  user: User
): Promise<Buffer> {
  let browser
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    
    const page = await browser.newPage()
    const html = generateAdvanceReceiptHTML(receipt, user)
    
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

function generateAdvanceReceiptHTML(receipt: AdvanceReceiptWithRelations, user: User): string {
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

  const amountInWords = numberToWordsIndian(Number(receipt.amountINR))
  const receiptDate = format(new Date(receipt.receiptDate), 'dd MMMM yyyy')
  const chequeDate = receipt.chequeDate ? format(new Date(receipt.chequeDate), 'dd MMMM yyyy') : null

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Advance Receipt - ${receipt.receiptNumber}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #333;
          line-height: 1.6;
        }
        
        .container {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #007bff;
        }
        
        .header h1 {
          color: #007bff;
          font-size: 28px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        
        .header h2 {
          font-size: 20px;
          color: #666;
          font-weight: 400;
        }
        
        .company-details {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }
        
        .company-info {
          font-size: 14px;
          color: #666;
          margin-bottom: 3px;
        }
        
        .receipt-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        
        .receipt-info-section {
          flex: 1;
        }
        
        .receipt-info-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        
        .receipt-info-value {
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }
        
        .client-section {
          margin-bottom: 30px;
          padding: 20px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
        }
        
        .section-title {
          font-size: 16px;
          font-weight: 600;
          color: #007bff;
          margin-bottom: 15px;
          text-transform: uppercase;
        }
        
        .client-details {
          font-size: 14px;
          color: #333;
          line-height: 1.8;
        }
        
        .amount-section {
          margin-bottom: 30px;
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 8px;
        }
        
        .amount-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        
        .amount-label {
          font-size: 14px;
          opacity: 0.9;
        }
        
        .amount-value {
          font-size: 18px;
          font-weight: 600;
        }
        
        .amount-total {
          border-top: 2px solid rgba(255,255,255,0.3);
          padding-top: 10px;
          margin-top: 10px;
        }
        
        .amount-total .amount-value {
          font-size: 24px;
        }
        
        .amount-words {
          margin-top: 15px;
          padding: 10px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          font-size: 14px;
          font-style: italic;
        }
        
        .payment-details {
          margin-bottom: 30px;
          padding: 20px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
        }
        
        .payment-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }
        
        .payment-item {
          font-size: 14px;
        }
        
        .payment-label {
          color: #666;
          margin-bottom: 2px;
        }
        
        .payment-value {
          font-weight: 600;
          color: #333;
        }
        
        .gst-section {
          margin-bottom: 30px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        
        .gst-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 15px;
        }
        
        .gst-item {
          text-align: center;
        }
        
        .gst-amount {
          font-size: 18px;
          font-weight: 600;
          color: #007bff;
        }
        
        .notes-section {
          margin-bottom: 30px;
          padding: 20px;
          background: #fff3cd;
          border: 1px solid #ffc107;
          border-radius: 8px;
        }
        
        .notes-content {
          font-size: 14px;
          color: #856404;
        }
        
        .signature-section {
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
        }
        
        .signature-box {
          text-align: center;
          width: 200px;
        }
        
        .signature-line {
          border-top: 2px solid #333;
          margin-bottom: 10px;
        }
        
        .signature-label {
          font-size: 14px;
          color: #666;
        }
        
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        
        .watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 120px;
          color: rgba(0,0,0,0.05);
          font-weight: bold;
          z-index: -1;
        }
        
        @media print {
          .container {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      <div class="watermark">ADVANCE</div>
      
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>ADVANCE RECEIPT VOUCHER</h1>
          <h2>Receipt No: ${receipt.receiptNumber}</h2>
        </div>
        
        <!-- Company Details -->
        <div class="company-details">
          <div class="company-name">${user.name || 'Company Name'}</div>
          ${user.gstin ? `<div class="company-info">GSTIN: ${user.gstin}</div>` : ''}
          ${user.pan ? `<div class="company-info">PAN: ${user.pan}</div>` : ''}
          ${user.address ? `<div class="company-info">${user.address}</div>` : ''}
        </div>
        
        <!-- Receipt Info -->
        <div class="receipt-info">
          <div class="receipt-info-section">
            <div class="receipt-info-label">Receipt Date</div>
            <div class="receipt-info-value">${receiptDate}</div>
          </div>
          <div class="receipt-info-section">
            <div class="receipt-info-label">Payment Mode</div>
            <div class="receipt-info-value">${receipt.paymentMode}</div>
          </div>
          <div class="receipt-info-section">
            <div class="receipt-info-label">Status</div>
            <div class="receipt-info-value">${receipt.status.replace('_', ' ')}</div>
          </div>
        </div>
        
        <!-- Client Details -->
        <div class="client-section">
          <div class="section-title">Received From</div>
          <div class="client-details">
            <strong>${receipt.client.name}</strong><br>
            ${receipt.client.company ? `${receipt.client.company}<br>` : ''}
            ${receipt.client.address}<br>
            ${receipt.client.country}<br>
            ${receipt.client.email}
            ${receipt.client.phone ? `<br>Phone: ${receipt.client.phone}` : ''}
            ${receipt.client.taxId ? `<br>Tax ID: ${receipt.client.taxId}` : ''}
          </div>
        </div>
        
        <!-- Amount Section -->
        <div class="amount-section">
          <div class="amount-row">
            <div class="amount-label">Amount Received</div>
            <div class="amount-value">${formatCurrency(Number(receipt.amount), receipt.currency)}</div>
          </div>
          
          ${receipt.currency !== 'INR' ? `
            <div class="amount-row">
              <div class="amount-label">Exchange Rate (1 ${receipt.currency} = INR)</div>
              <div class="amount-value">${Number(receipt.exchangeRate).toFixed(4)}</div>
            </div>
            
            <div class="amount-row amount-total">
              <div class="amount-label">Amount in INR</div>
              <div class="amount-value">${formatINR(Number(receipt.amountINR))}</div>
            </div>
          ` : ''}
          
          <div class="amount-words">
            <strong>Amount in Words:</strong> ${amountInWords} only
          </div>
        </div>
        
        <!-- Payment Details -->
        <div class="payment-details">
          <div class="section-title">Payment Details</div>
          <div class="payment-grid">
            <div class="payment-item">
              <div class="payment-label">Payment Mode</div>
              <div class="payment-value">${receipt.paymentMode}</div>
            </div>
            
            ${receipt.bankReference ? `
              <div class="payment-item">
                <div class="payment-label">Bank Reference</div>
                <div class="payment-value">${receipt.bankReference}</div>
              </div>
            ` : ''}
            
            ${receipt.bankName ? `
              <div class="payment-item">
                <div class="payment-label">Bank Name</div>
                <div class="payment-value">${receipt.bankName}</div>
              </div>
            ` : ''}
            
            ${receipt.chequeNumber ? `
              <div class="payment-item">
                <div class="payment-label">Cheque Number</div>
                <div class="payment-value">${receipt.chequeNumber}</div>
              </div>
            ` : ''}
            
            ${chequeDate ? `
              <div class="payment-item">
                <div class="payment-label">Cheque Date</div>
                <div class="payment-value">${chequeDate}</div>
              </div>
            ` : ''}
          </div>
        </div>
        
        <!-- GST Section (if applicable) -->
        ${receipt.isGSTApplicable ? `
          <div class="gst-section">
            <div class="section-title">GST Details</div>
            <div class="gst-grid">
              <div class="gst-item">
                <div class="payment-label">GST Rate</div>
                <div class="gst-amount">${Number(receipt.gstRate || 0)}%</div>
              </div>
              
              ${receipt.igstAmount && Number(receipt.igstAmount) > 0 ? `
                <div class="gst-item">
                  <div class="payment-label">IGST</div>
                  <div class="gst-amount">${formatINR(Number(receipt.igstAmount))}</div>
                </div>
              ` : ''}
              
              ${receipt.cgstAmount && Number(receipt.cgstAmount) > 0 ? `
                <div class="gst-item">
                  <div class="payment-label">CGST</div>
                  <div class="gst-amount">${formatINR(Number(receipt.cgstAmount))}</div>
                </div>
                <div class="gst-item">
                  <div class="payment-label">SGST</div>
                  <div class="gst-amount">${formatINR(Number(receipt.sgstAmount || 0))}</div>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
        
        <!-- Notes Section -->
        ${receipt.notes ? `
          <div class="notes-section">
            <div class="section-title">Notes</div>
            <div class="notes-content">${receipt.notes}</div>
          </div>
        ` : ''}
        
        <!-- Adjustment Status -->
        <div class="payment-details">
          <div class="section-title">Adjustment Status</div>
          <div class="payment-grid">
            <div class="payment-item">
              <div class="payment-label">Total Received</div>
              <div class="payment-value">${formatCurrency(Number(receipt.amount), receipt.currency)}</div>
            </div>
            <div class="payment-item">
              <div class="payment-label">Adjusted Amount</div>
              <div class="payment-value">${formatCurrency(Number(receipt.adjustedAmount), receipt.currency)}</div>
            </div>
            <div class="payment-item">
              <div class="payment-label">Unadjusted Amount</div>
              <div class="payment-value">${formatCurrency(Number(receipt.unadjustedAmount), receipt.currency)}</div>
            </div>
            <div class="payment-item">
              <div class="payment-label">Status</div>
              <div class="payment-value">${receipt.status.replace('_', ' ')}</div>
            </div>
          </div>
        </div>
        
        <!-- Signature Section -->
        <div class="signature-section">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Receiver's Signature</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-label">Authorized Signatory</div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <p>This is a computer generated receipt</p>
          <p>Generated on ${format(new Date(), 'dd MMMM yyyy hh:mm a')}</p>
        </div>
      </div>
    </body>
    </html>
  `
}