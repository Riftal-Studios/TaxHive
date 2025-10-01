/**
 * Payment Receipt PDF Generator
 * 
 * Generates payment receipt PDFs using React PDF.
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
import type { Payment, Invoice, Client, User } from '@prisma/client';

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
  receiptBox: {
    marginTop: 20,
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  receiptLabel: {
    fontSize: 11,
    color: '#666666',
  },
  receiptValue: {
    fontSize: 11,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  amountBox: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#e8f5e9',
    borderRadius: 5,
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 5,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2e7d32',
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
    marginTop: 50,
    alignItems: 'flex-end',
  },
  signatureText: {
    fontSize: 10,
    marginTop: 5,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#4caf50',
    borderRadius: 3,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

interface PaymentWithRelations extends Payment {
  invoice: Invoice & {
    client: Client;
    user: User;
  };
}

interface ReceiptPDFProps {
  payment: PaymentWithRelations;
}

// Receipt PDF Component
export const ReceiptPDF: React.FC<ReceiptPDFProps> = ({ payment }) => {
  const { invoice } = payment;
  
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PAYMENT RECEIPT</Text>
          <Text style={styles.subtitle}>(Original for Payer)</Text>
        </View>

        {/* Receipt Status */}
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>PAYMENT RECEIVED</Text>
        </View>

        {/* Company Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Received By:</Text>
              <Text style={styles.boldValue}>{invoice.user.businessName}</Text>
              <Text style={styles.value}>GSTIN: {invoice.user.gstin}</Text>
              <Text style={styles.value}>{invoice.user.address}</Text>
              <Text style={styles.value}>{invoice.user.city}, {invoice.user.state} {invoice.user.pincode}</Text>
              <Text style={styles.value}>Email: {invoice.user.email}</Text>
              {invoice.user.phone && <Text style={styles.value}>Phone: {invoice.user.phone}</Text>}
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Receipt Details:</Text>
              <Text style={styles.value}>Receipt No: {payment.receiptNumber || `REC-${payment.id.slice(0, 8)}`}</Text>
              <Text style={styles.value}>Date: {formatDate(payment.paymentDate)}</Text>
              <Text style={styles.value}>Payment Method: {payment.paymentMethod}</Text>
              {payment.transactionId && (
                <Text style={styles.value}>Transaction ID: {payment.transactionId}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Client Details */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.label}>Received From:</Text>
              <Text style={styles.boldValue}>{invoice.client.businessName}</Text>
              {invoice.client.gstin && <Text style={styles.value}>GSTIN: {invoice.client.gstin}</Text>}
              <Text style={styles.value}>{invoice.client.address}</Text>
              <Text style={styles.value}>{invoice.client.city}, {invoice.client.state} {invoice.client.pincode}</Text>
              <Text style={styles.value}>{invoice.client.country}</Text>
              <Text style={styles.value}>Email: {invoice.client.email}</Text>
            </View>
          </View>
        </View>

        {/* Payment Details Box */}
        <View style={styles.receiptBox}>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Invoice Number:</Text>
            <Text style={styles.receiptValue}>{invoice.invoiceNumber}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Invoice Date:</Text>
            <Text style={styles.receiptValue}>{formatDate(invoice.invoiceDate)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Invoice Amount:</Text>
            <Text style={styles.receiptValue}>{formatCurrency(invoice.total, payment.currency || invoice.currency)}</Text>
          </View>
          <View style={styles.receiptRow}>
            <Text style={styles.receiptLabel}>Payment Method:</Text>
            <Text style={styles.receiptValue}>{payment.paymentMethod}</Text>
          </View>
          {payment.bankName && (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Bank:</Text>
              <Text style={styles.receiptValue}>{payment.bankName}</Text>
            </View>
          )}
          {payment.transactionId && (
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>Reference Number:</Text>
              <Text style={styles.receiptValue}>{payment.transactionId}</Text>
            </View>
          )}
        </View>

        {/* Amount Box */}
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Amount Received</Text>
          <Text style={styles.amountValue}>
            {formatCurrency(payment.amount, payment.currency || invoice.currency)}
          </Text>
        </View>

        {/* Notes */}
        {payment.notes && (
          <View style={styles.section}>
            <Text style={styles.label}>Notes:</Text>
            <Text style={styles.value}>{payment.notes}</Text>
          </View>
        )}

        {/* Signature */}
        <View style={styles.signature}>
          <Text style={styles.signatureText}>_______________________</Text>
          <Text style={styles.signatureText}>Authorized Receiver</Text>
          <Text style={styles.signatureText}>{invoice.user.businessName}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This is a computer-generated receipt and does not require a physical signature.
          </Text>
          <Text style={styles.footerText}>
            Thank you for your payment!
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
export async function generateReceiptPDF(payment: PaymentWithRelations): Promise<Buffer> {
  try {
    const pdfBuffer = await renderToBuffer(<ReceiptPDF payment={payment} />);
    return pdfBuffer;
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    throw new Error('Failed to generate receipt PDF');
  }
}