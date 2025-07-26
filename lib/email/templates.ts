function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
  }).format(amount)
}

export interface EmailTemplateData {
  // Common fields
  clientName: string
  senderName: string
  senderEmail?: string
  companyName?: string
  companyAddress?: string
  companyGSTIN?: string
  
  // Invoice specific
  invoiceNumber?: string
  invoiceDate?: string
  dueDate?: string
  amount?: number
  currency?: string
  viewUrl?: string
  downloadUrl?: string
  
  // Payment reminder specific
  daysOverdue?: number
  
  // LUT specific
  lutNumber?: string
  expiryDate?: string
  daysRemaining?: number
  
  // Custom message
  customMessage?: string
}

const baseStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: #4f46e5;
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: normal;
    }
    .content {
      padding: 40px 30px;
    }
    .invoice-details {
      background-color: #f9fafb;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-row:last-child {
      border-bottom: none;
    }
    .detail-label {
      font-weight: 600;
      color: #6b7280;
    }
    .detail-value {
      color: #111827;
    }
    .amount-row {
      font-size: 18px;
      font-weight: bold;
      color: #4f46e5;
      margin-top: 10px;
      padding-top: 10px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #4f46e5;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 10px 5px;
      font-weight: 600;
    }
    .button-secondary {
      background-color: #6b7280;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      font-size: 14px;
      color: #6b7280;
    }
    .footer a {
      color: #4f46e5;
      text-decoration: none;
    }
    .custom-message {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .warning {
      color: #dc2626;
      font-weight: 600;
    }
    @media only screen and (max-width: 600px) {
      .content {
        padding: 20px 15px;
      }
      .detail-row {
        flex-direction: column;
      }
      .detail-value {
        margin-top: 5px;
      }
    }
  </style>
`

export const emailTemplates = {
  invoice: (data: EmailTemplateData) => {
    const formattedAmount = data.amount && data.currency 
      ? formatCurrency(data.amount, data.currency)
      : 'N/A'
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <h1>Invoice ${data.invoiceNumber}</h1>
          </div>
          
          <div class="content">
            <p>Dear ${data.clientName},</p>
            
            <p>I hope this email finds you well. Please find below the details of invoice ${data.invoiceNumber} for services rendered.</p>
            
            ${data.customMessage ? `
              <div class="custom-message">
                ${data.customMessage}
              </div>
            ` : ''}
            
            <div class="invoice-details">
              <div class="detail-row">
                <span class="detail-label">Invoice Number:</span>
                <span class="detail-value">${data.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Invoice Date:</span>
                <span class="detail-value">${data.invoiceDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Due Date:</span>
                <span class="detail-value">${data.dueDate}</span>
              </div>
              <div class="detail-row amount-row">
                <span class="detail-label">Total Amount:</span>
                <span class="detail-value">${formattedAmount}</span>
              </div>
            </div>
            
            <p>The PDF invoice is attached to this email for your reference. You can also access it online using the buttons below:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.viewUrl}" class="button">View Invoice</a>
              <a href="${data.downloadUrl}" class="button button-secondary">Download PDF</a>
            </div>
            
            <p>If you have any questions regarding this invoice, please don't hesitate to reach out.</p>
            
            <p>Thank you for your business!</p>
            
            <p>Best regards,<br>
            ${data.senderName}<br>
            ${data.senderEmail ? data.senderEmail : ''}</p>
          </div>
          
          <div class="footer">
            ${data.companyName ? `<p><strong>${data.companyName}</strong></p>` : ''}
            ${data.companyGSTIN ? `<p>GSTIN: ${data.companyGSTIN}</p>` : ''}
            ${data.companyAddress ? `<p>${data.companyAddress.replace(/\n/g, '<br>')}</p>` : ''}
            <p style="margin-top: 20px; font-size: 12px;">
              This is an automated email. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
    
    const text = `Invoice ${data.invoiceNumber}

Dear ${data.clientName},

I hope this email finds you well. Please find below the details of invoice ${data.invoiceNumber} for services rendered.

${data.customMessage ? data.customMessage + '\n\n' : ''}

Invoice Details:
- Invoice Number: ${data.invoiceNumber}
- Invoice Date: ${data.invoiceDate}
- Due Date: ${data.dueDate}
- Total Amount: ${formattedAmount}

The PDF invoice is attached to this email for your reference.

View Invoice: ${data.viewUrl}
Download PDF: ${data.downloadUrl}

If you have any questions regarding this invoice, please don't hesitate to reach out.

Thank you for your business!

Best regards,
${data.senderName}
${data.senderEmail || ''}

${data.companyName || ''}
${data.companyGSTIN ? 'GSTIN: ' + data.companyGSTIN : ''}
${data.companyAddress || ''}

This is an automated email. Please do not reply directly to this message.`
    
    return { html, text }
  },
  
  'payment-reminder': (data: EmailTemplateData) => {
    const formattedAmount = data.amount && data.currency 
      ? formatCurrency(data.amount, data.currency)
      : 'N/A'
    
    const isOverdue = (data.daysOverdue || 0) > 0
    const urgency = (data.daysOverdue || 0) > 30 ? 'urgent' : 'friendly'
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="email-container">
          <div class="header" ${urgency === 'urgent' ? 'style="background-color: #dc2626;"' : ''}>
            <h1>Payment Reminder: Invoice ${data.invoiceNumber}</h1>
          </div>
          
          <div class="content">
            <p>Dear ${data.clientName},</p>
            
            ${isOverdue ? `
              <p>This is a ${urgency} reminder that invoice ${data.invoiceNumber} is now <span class="warning">${data.daysOverdue} days overdue</span>.</p>
            ` : `
              <p>This is a friendly reminder that invoice ${data.invoiceNumber} is due soon.</p>
            `}
            
            ${data.customMessage ? `
              <div class="custom-message">
                ${data.customMessage}
              </div>
            ` : ''}
            
            <div class="invoice-details">
              <div class="detail-row">
                <span class="detail-label">Invoice Number:</span>
                <span class="detail-value">${data.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Invoice Date:</span>
                <span class="detail-value">${data.invoiceDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Due Date:</span>
                <span class="detail-value ${isOverdue ? 'warning' : ''}">${data.dueDate}</span>
              </div>
              ${isOverdue ? `
                <div class="detail-row">
                  <span class="detail-label">Days Overdue:</span>
                  <span class="detail-value warning">${data.daysOverdue} days</span>
                </div>
              ` : ''}
              <div class="detail-row amount-row">
                <span class="detail-label">Outstanding Amount:</span>
                <span class="detail-value">${formattedAmount}</span>
              </div>
            </div>
            
            <p>Please process the payment at your earliest convenience to avoid any late fees or service interruptions.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.viewUrl}" class="button">View Invoice</a>
              <a href="${data.downloadUrl}" class="button button-secondary">Download PDF</a>
            </div>
            
            <p>If you have already made the payment, please disregard this reminder. If you have any questions or concerns, please contact me immediately.</p>
            
            <p>Thank you for your prompt attention to this matter.</p>
            
            <p>Best regards,<br>
            ${data.senderName}<br>
            ${data.senderEmail ? data.senderEmail : ''}</p>
          </div>
          
          <div class="footer">
            ${data.companyName ? `<p><strong>${data.companyName}</strong></p>` : ''}
            ${data.companyGSTIN ? `<p>GSTIN: ${data.companyGSTIN}</p>` : ''}
            ${data.companyAddress ? `<p>${data.companyAddress.replace(/\n/g, '<br>')}</p>` : ''}
            <p style="margin-top: 20px; font-size: 12px;">
              This is an automated reminder. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
    
    const text = `Payment Reminder: Invoice ${data.invoiceNumber}

Dear ${data.clientName},

${isOverdue 
  ? `This is a ${urgency} reminder that invoice ${data.invoiceNumber} is now ${data.daysOverdue} days overdue.`
  : `This is a friendly reminder that invoice ${data.invoiceNumber} is due soon.`
}

${data.customMessage ? data.customMessage + '\n\n' : ''}

Invoice Details:
- Invoice Number: ${data.invoiceNumber}
- Invoice Date: ${data.invoiceDate}
- Due Date: ${data.dueDate}
${isOverdue ? `- Days Overdue: ${data.daysOverdue} days` : ''}
- Outstanding Amount: ${formattedAmount}

Please process the payment at your earliest convenience to avoid any late fees or service interruptions.

View Invoice: ${data.viewUrl}
Download PDF: ${data.downloadUrl}

If you have already made the payment, please disregard this reminder. If you have any questions or concerns, please contact me immediately.

Thank you for your prompt attention to this matter.

Best regards,
${data.senderName}
${data.senderEmail || ''}

${data.companyName || ''}
${data.companyGSTIN ? 'GSTIN: ' + data.companyGSTIN : ''}
${data.companyAddress || ''}

This is an automated reminder. Please do not reply directly to this message.`
    
    return { html, text }
  },
  
  'lut-expiry': (data: EmailTemplateData) => {
    const isUrgent = (data.daysRemaining || 0) <= 7
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="email-container">
          <div class="header" ${isUrgent ? 'style="background-color: #dc2626;"' : ''}>
            <h1>${isUrgent ? 'Urgent: ' : ''}LUT Expiry Reminder</h1>
          </div>
          
          <div class="content">
            <p>Dear ${data.senderName},</p>
            
            <p class="${isUrgent ? 'warning' : ''}">
              Your Letter of Undertaking (LUT) is set to expire in <strong>${data.daysRemaining} days</strong>.
            </p>
            
            <div class="invoice-details">
              <div class="detail-row">
                <span class="detail-label">LUT Number:</span>
                <span class="detail-value">${data.lutNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Expiry Date:</span>
                <span class="detail-value ${isUrgent ? 'warning' : ''}">${data.expiryDate}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Days Remaining:</span>
                <span class="detail-value ${isUrgent ? 'warning' : ''}">${data.daysRemaining} days</span>
              </div>
            </div>
            
            <p><strong>Important:</strong> Please renew your LUT before the expiry date to continue exporting services without GST. Failure to renew may result in:</p>
            
            <ul>
              <li>Requirement to charge IGST on export invoices</li>
              <li>Need to claim refunds for GST paid</li>
              <li>Compliance issues with GST regulations</li>
            </ul>
            
            <p>To renew your LUT, please visit the GST portal and submit Form GST RFD-11.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://www.gst.gov.in/" class="button">Visit GST Portal</a>
            </div>
            
            <p>If you have already renewed your LUT, please update the details in your profile to stop receiving these reminders.</p>
            
            <p>Best regards,<br>
            GSTHive Team</p>
          </div>
          
          <div class="footer">
            <p><strong>GSTHive</strong></p>
            <p>GST-Compliant Invoice Management for Indian Freelancers</p>
            <p style="margin-top: 20px; font-size: 12px;">
              This is an automated reminder. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
    
    const text = `${isUrgent ? 'Urgent: ' : ''}LUT Expiry Reminder

Dear ${data.senderName},

Your Letter of Undertaking (LUT) is set to expire in ${data.daysRemaining} days.

LUT Details:
- LUT Number: ${data.lutNumber}
- Expiry Date: ${data.expiryDate}
- Days Remaining: ${data.daysRemaining} days

Important: Please renew your LUT before the expiry date to continue exporting services without GST. Failure to renew may result in:

- Requirement to charge IGST on export invoices
- Need to claim refunds for GST paid
- Compliance issues with GST regulations

To renew your LUT, please visit the GST portal and submit Form GST RFD-11.

Visit GST Portal: https://www.gst.gov.in/

If you have already renewed your LUT, please update the details in your profile to stop receiving these reminders.

Best regards,
GSTHive Team

This is an automated reminder. Please do not reply directly to this message.`
    
    return { html, text }
  },
  
  'payment-received': (data: EmailTemplateData) => {
    const formattedAmount = data.amount && data.currency 
      ? formatCurrency(data.amount, data.currency)
      : 'N/A'
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${baseStyles}
      </head>
      <body>
        <div class="email-container">
          <div class="header" style="background-color: #10b981;">
            <h1>Payment Received - Thank You!</h1>
          </div>
          
          <div class="content">
            <p>Dear ${data.clientName},</p>
            
            <p>This email confirms that we have received your payment for invoice ${data.invoiceNumber}. Thank you for your prompt payment!</p>
            
            <div class="invoice-details">
              <div class="detail-row">
                <span class="detail-label">Invoice Number:</span>
                <span class="detail-value">${data.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Amount Received:</span>
                <span class="detail-value" style="color: #10b981; font-weight: bold;">${formattedAmount}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Date:</span>
                <span class="detail-value">${new Date().toLocaleDateString()}</span>
              </div>
            </div>
            
            <p>Your invoice has been marked as paid in our system. A receipt for this payment is attached for your records.</p>
            
            <p>We appreciate your business and look forward to continuing our partnership.</p>
            
            <p>Best regards,<br>
            ${data.senderName}<br>
            ${data.senderEmail ? data.senderEmail : ''}</p>
          </div>
          
          <div class="footer">
            ${data.companyName ? `<p><strong>${data.companyName}</strong></p>` : ''}
            ${data.companyGSTIN ? `<p>GSTIN: ${data.companyGSTIN}</p>` : ''}
            ${data.companyAddress ? `<p>${data.companyAddress.replace(/\n/g, '<br>')}</p>` : ''}
            <p style="margin-top: 20px; font-size: 12px;">
              This is an automated confirmation. Please do not reply directly to this message.
            </p>
          </div>
        </div>
      </body>
      </html>
    `
    
    const text = `Payment Received - Thank You!

Dear ${data.clientName},

This email confirms that we have received your payment for invoice ${data.invoiceNumber}. Thank you for your prompt payment!

Payment Details:
- Invoice Number: ${data.invoiceNumber}
- Amount Received: ${formattedAmount}
- Payment Date: ${new Date().toLocaleDateString()}

Your invoice has been marked as paid in our system. A receipt for this payment is attached for your records.

We appreciate your business and look forward to continuing our partnership.

Best regards,
${data.senderName}
${data.senderEmail || ''}

${data.companyName || ''}
${data.companyGSTIN ? 'GSTIN: ' + data.companyGSTIN : ''}
${data.companyAddress || ''}

This is an automated confirmation. Please do not reply directly to this message.`
    
    return { html, text }
  }
}