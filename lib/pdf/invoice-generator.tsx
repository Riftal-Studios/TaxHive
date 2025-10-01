/**
 * Invoice PDF Generator
 * 
 * Generates GST-compliant PDF invoices using React PDF.
 * Complies with GST Rule 46 for tax invoices.
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Invoice, Client, User, InvoiceLineItem, TaxBreakdown } from '@prisma/client';

// Register fonts if needed (optional - uses default Helvetica)
// Font.register({
//   family: 'Roboto',
//   src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5Q.ttf',
// });

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  column: {
    flexDirection: 'column',
    flex: 1,
  },
  label: {
    fontSize: 9,
    color: '#666666',
    marginBottom: 2,
  },
  value: {
    fontSize: 11,
    color: '#1a1a1a',
  },
  boldValue: {
    fontSize: 11,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  table: {
    marginTop: 20,
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    paddingBottom: 5,
    marginBottom: 5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eeeeee',
  },
  tableCol: {
    flex: 1,
    fontSize: 10,
  },
  tableColHeader: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableColWide: {
    flex: 2,
    fontSize: 10,
  },
  tableColHeaderWide: {
    flex: 2,
    fontSize: 10,
    fontWeight: 'bold',
  },
  tableColRight: {
    flex: 1,
    fontSize: 10,
    textAlign: 'right',
  },
  tableColHeaderRight: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  totalsSection: {
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 11,
    marginRight: 20,
    width: 100,
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 11,
    width: 100,
    textAlign: 'right',
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#666666',
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 20,
    width: 100,
    textAlign: 'right',
  },
  grandTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 100,
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
  },
  footerText: {
    fontSize: 9,
    color: '#666666',
    textAlign: 'center',
  },
  lutDeclaration: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  lutText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333333',
  },
  signature: {
    marginTop: 40,
    alignItems: 'flex-end',
  },
  signatureText: {
    fontSize: 10,
    marginTop: 5,
  },
});

interface InvoiceWithRelations extends Invoice {
  client: Client;
  user: User;
  lineItems: InvoiceLineItem[];
  taxBreakdown: TaxBreakdown[];
}

interface InvoicePDFProps {
  invoice: InvoiceWithRelations;
}

// Invoice PDF Component
export const InvoicePDF: React.FC<InvoicePDFProps> = ({ invoice }) => {
  const isExport = invoice.placeOfSupply === 'Outside India (Section 2-6)';
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{invoice.isProforma ? 'PROFORMA INVOICE' : 'TAX INVOICE'}</Text>
          <Text style={styles.subtitle}>
            (Original for Recipient)
            {isExport && ' | SUPPLY MEANT FOR EXPORT'}
          </Text>
        </View>

        {/* Supplier Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>From:</Text>
              <Text style={styles.boldValue}>{invoice.user.businessName}</Text>
              <Text style={styles.value}>GSTIN: {invoice.user.gstin}</Text>
              <Text style={styles.value}>{invoice.user.address}</Text>
              <Text style={styles.value}>{invoice.user.city}, {invoice.user.state} {invoice.user.pincode}</Text>
              <Text style={styles.value}>Email: {invoice.user.email}</Text>
              {invoice.user.phone && <Text style={styles.value}>Phone: {invoice.user.phone}</Text>}
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Invoice Details:</Text>
              <Text style={styles.value}>Invoice No: {invoice.invoiceNumber}</Text>
              <Text style={styles.value}>Date: {formatDate(invoice.invoiceDate)}</Text>
              {invoice.dueDate && <Text style={styles.value}>Due Date: {formatDate(invoice.dueDate)}</Text>}
              <Text style={styles.value}>Status: {invoice.status}</Text>
              {invoice.poNumber && <Text style={styles.value}>PO Number: {invoice.poNumber}</Text>}
            </View>
          </View>
        </View>

        {/* Client Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Bill To:</Text>
              <Text style={styles.boldValue}>{invoice.client.businessName}</Text>
              {invoice.client.gstin && <Text style={styles.value}>GSTIN: {invoice.client.gstin}</Text>}
              <Text style={styles.value}>{invoice.client.address}</Text>
              <Text style={styles.value}>{invoice.client.city}, {invoice.client.state} {invoice.client.pincode}</Text>
              <Text style={styles.value}>{invoice.client.country}</Text>
              <Text style={styles.value}>Email: {invoice.client.email}</Text>
              {invoice.client.phone && <Text style={styles.value}>Phone: {invoice.client.phone}</Text>}
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Supply Details:</Text>
              <Text style={styles.value}>Place of Supply: {invoice.placeOfSupply}</Text>
              <Text style={styles.value}>Supply Type: {invoice.supplyType}</Text>
              {invoice.shippingAddress && (
                <>
                  <Text style={styles.label}>Ship To:</Text>
                  <Text style={styles.value}>{invoice.shippingAddress}</Text>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableColHeader}>#</Text>
            <Text style={styles.tableColHeaderWide}>Description</Text>
            <Text style={styles.tableColHeader}>HSN/SAC</Text>
            <Text style={styles.tableColHeaderRight}>Qty</Text>
            <Text style={styles.tableColHeaderRight}>Rate</Text>
            <Text style={styles.tableColHeaderRight}>Amount</Text>
          </View>
          
          {invoice.lineItems.map((item, index) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.tableCol}>{index + 1}</Text>
              <Text style={styles.tableColWide}>{item.description}</Text>
              <Text style={styles.tableCol}>{item.hsnSacCode}</Text>
              <Text style={styles.tableColRight}>{item.quantity} {item.unit}</Text>
              <Text style={styles.tableColRight}>{formatCurrency(item.rate, invoice.currency)}</Text>
              <Text style={styles.tableColRight}>{formatCurrency(item.amount, invoice.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals Section */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalValue}>{formatCurrency(invoice.subtotal, invoice.currency)}</Text>
          </View>
          
          {invoice.discountAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Discount:</Text>
              <Text style={styles.totalValue}>-{formatCurrency(invoice.discountAmount, invoice.currency)}</Text>
            </View>
          )}
          
          {/* Tax Breakdown */}
          {invoice.taxBreakdown.map((tax) => (
            <View key={tax.id} style={styles.totalRow}>
              <Text style={styles.totalLabel}>{tax.taxType} @ {tax.rate}%:</Text>
              <Text style={styles.totalValue}>{formatCurrency(tax.amount, invoice.currency)}</Text>
            </View>
          ))}
          
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(invoice.total, invoice.currency)}</Text>
          </View>
          
          {invoice.currency !== 'INR' && invoice.exchangeRate && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Exchange Rate:</Text>
              <Text style={styles.totalValue}>1 {invoice.currency} = {invoice.exchangeRate} INR</Text>
            </View>
          )}
        </View>

        {/* LUT Declaration for Exports */}
        {isExport && invoice.user.lutNumber && (
          <View style={styles.lutDeclaration}>
            <Text style={styles.lutText}>
              SUPPLY MEANT FOR EXPORT UNDER LUT NO {invoice.user.lutNumber} DATED {invoice.user.lutDate || 'N/A'}
            </Text>
            <Text style={styles.lutText}>TAX NOT PAYABLE - 0% IGST</Text>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.section}>
            <Text style={styles.label}>Notes:</Text>
            <Text style={styles.value}>{invoice.notes}</Text>
          </View>
        )}

        {/* Terms and Conditions */}
        {invoice.termsAndConditions && (
          <View style={styles.section}>
            <Text style={styles.label}>Terms and Conditions:</Text>
            <Text style={styles.value}>{invoice.termsAndConditions}</Text>
          </View>
        )}

        {/* Signature */}
        <View style={styles.signature}>
          <Text style={styles.signatureText}>_______________________</Text>
          <Text style={styles.signatureText}>Authorized Signatory</Text>
          <Text style={styles.signatureText}>{invoice.user.businessName}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a computer-generated invoice and does not require a physical signature.
          </Text>
          <Text style={styles.footerText}>
            Generated on {formatDate(new Date())} | GSTHive - GST Compliant Invoice Management
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// Generate PDF Buffer
export async function generateInvoicePDF(invoice: InvoiceWithRelations): Promise<Buffer> {
  try {
    const pdfBuffer = await renderToBuffer(<InvoicePDF invoice={invoice} />);
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    throw new Error('Failed to generate invoice PDF');
  }
}