/**
 * Credit Note PDF Generator
 * 
 * Generates GST-compliant credit note PDFs using React PDF.
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { CreditDebitNote, Invoice, Client, User, CreditDebitNoteLineItem } from '@prisma/client';

// Create styles (reusing invoice styles)
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
  signature: {
    marginTop: 40,
    alignItems: 'flex-end',
  },
  signatureText: {
    fontSize: 10,
    marginTop: 5,
  },
  reasonBox: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  reasonText: {
    fontSize: 10,
    color: '#333333',
  },
});

interface CreditNoteWithRelations extends CreditDebitNote {
  invoice: Invoice & {
    client: Client;
    user: User;
  };
  lineItems: CreditDebitNoteLineItem[];
}

interface CreditNotePDFProps {
  creditNote: CreditNoteWithRelations;
}

// Credit Note PDF Component
export const CreditNotePDF: React.FC<CreditNotePDFProps> = ({ creditNote }) => {
  const { invoice } = creditNote;
  const isExport = invoice.placeOfSupply === 'Outside India (Section 2-6)';
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CREDIT NOTE</Text>
          <Text style={styles.subtitle}>
            (Original for Recipient)
            {isExport && ' | EXPORT CREDIT NOTE'}
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
              <Text style={styles.label}>Credit Note Details:</Text>
              <Text style={styles.value}>Credit Note No: {creditNote.noteNumber}</Text>
              <Text style={styles.value}>Date: {formatDate(creditNote.noteDate)}</Text>
              <Text style={styles.value}>Original Invoice: {invoice.invoiceNumber}</Text>
              <Text style={styles.value}>Invoice Date: {formatDate(invoice.invoiceDate)}</Text>
            </View>
          </View>
        </View>

        {/* Client Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Credit To:</Text>
              <Text style={styles.boldValue}>{invoice.client.businessName}</Text>
              {invoice.client.gstin && <Text style={styles.value}>GSTIN: {invoice.client.gstin}</Text>}
              <Text style={styles.value}>{invoice.client.address}</Text>
              <Text style={styles.value}>{invoice.client.city}, {invoice.client.state} {invoice.client.pincode}</Text>
              <Text style={styles.value}>{invoice.client.country}</Text>
              <Text style={styles.value}>Email: {invoice.client.email}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Supply Details:</Text>
              <Text style={styles.value}>Place of Supply: {invoice.placeOfSupply}</Text>
              <Text style={styles.value}>Supply Type: {invoice.supplyType}</Text>
            </View>
          </View>
        </View>

        {/* Reason for Credit Note */}
        <View style={styles.reasonBox}>
          <Text style={styles.label}>Reason for Credit Note:</Text>
          <Text style={styles.reasonText}>{creditNote.reason}</Text>
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
          
          {creditNote.lineItems.map((item, index) => (
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
            <Text style={styles.totalValue}>{formatCurrency(creditNote.subtotal, invoice.currency)}</Text>
          </View>
          
          {/* Tax Amounts */}
          {creditNote.cgstAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>CGST:</Text>
              <Text style={styles.totalValue}>{formatCurrency(creditNote.cgstAmount, invoice.currency)}</Text>
            </View>
          )}
          
          {creditNote.sgstAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>SGST:</Text>
              <Text style={styles.totalValue}>{formatCurrency(creditNote.sgstAmount, invoice.currency)}</Text>
            </View>
          )}
          
          {creditNote.igstAmount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IGST:</Text>
              <Text style={styles.totalValue}>{formatCurrency(creditNote.igstAmount, invoice.currency)}</Text>
            </View>
          )}
          
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total Credit:</Text>
            <Text style={styles.grandTotalValue}>{formatCurrency(creditNote.total, invoice.currency)}</Text>
          </View>
        </View>

        {/* Notes */}
        {creditNote.notes && (
          <View style={styles.section}>
            <Text style={styles.label}>Notes:</Text>
            <Text style={styles.value}>{creditNote.notes}</Text>
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
            This is a computer-generated credit note and does not require a physical signature.
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
export async function generateCreditNotePDF(creditNote: CreditNoteWithRelations): Promise<Buffer> {
  try {
    const pdfBuffer = await renderToBuffer(<CreditNotePDF creditNote={creditNote} />);
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating credit note PDF:', error);
    throw new Error('Failed to generate credit note PDF');
  }
}