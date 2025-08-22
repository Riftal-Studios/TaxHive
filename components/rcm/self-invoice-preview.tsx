'use client'

import React from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Alert,
  Stack,
  Paper,
} from '@mui/material'
import {
  Close as CloseIcon,
  GetApp as DownloadIcon,
  Print as PrintIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material'
import dayjs from 'dayjs'

interface SelfInvoicePreviewProps {
  invoice: any
  onClose?: () => void
  onDownload?: () => void
  onPrint?: () => void
  showActions?: boolean
}

export function SelfInvoicePreview({ 
  invoice, 
  onClose, 
  onDownload, 
  onPrint,
  showActions = true 
}: SelfInvoicePreviewProps) {
  
  const getComplianceStatus = () => {
    if (!invoice.goodsReceiptDate) return null

    const daysSinceReceipt = dayjs().diff(dayjs(invoice.goodsReceiptDate), 'day')
    
    if (daysSinceReceipt > 30) {
      return {
        severity: 'error' as const,
        message: `Self-invoice is overdue by ${daysSinceReceipt - 30} days. Interest and penalty apply.`,
        icon: <WarningIcon />,
      }
    } else if (daysSinceReceipt > 25) {
      return {
        severity: 'warning' as const,
        message: `Due soon - ${30 - daysSinceReceipt} days remaining within compliance period.`,
        icon: <WarningIcon />,
      }
    } else {
      return {
        severity: 'success' as const,
        message: `Within compliance period. ${30 - daysSinceReceipt} days remaining.`,
        icon: <CheckCircleIcon />,
      }
    }
  }

  const complianceStatus = getComplianceStatus()

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      {showActions && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ReceiptIcon color="primary" />
            Self-Invoice Preview
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onDownload && (
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={onDownload}
              >
                Download PDF
              </Button>
            )}
            {onPrint && (
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={onPrint}
              >
                Print
              </Button>
            )}
            {onClose && (
              <IconButton onClick={onClose} aria-label="close">
                <CloseIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      )}

      {/* Compliance Status */}
      {complianceStatus && (
        <Alert
          severity={complianceStatus.severity}
          icon={complianceStatus.icon}
          sx={{ mb: 3 }}
        >
          {complianceStatus.message}
        </Alert>
      )}

      {/* Invoice Content */}
      <Paper elevation={1} sx={{ p: 3 }}>
        {/* Header Section */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h4" component="h1" color="primary" gutterBottom>
            SELF INVOICE
          </Typography>
          <Typography variant="h6" color="text.secondary">
            (As per GST Rule 47A - Reverse Charge Mechanism)
          </Typography>
        </Box>

        {/* Invoice Details */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Invoice Details
                </Typography>
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Invoice Number:</Typography>
                    <Typography variant="body2" fontWeight={600}>{invoice.invoiceNumber}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Invoice Date:</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {dayjs(invoice.invoiceDate).format('DD/MM/YYYY')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">RCM Type:</Typography>
                    <Chip
                      label={invoice.rcmType}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Supply Type:</Typography>
                    <Typography variant="body2" fontWeight={600}>{invoice.supplyType}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Place of Supply:</Typography>
                    <Typography variant="body2" fontWeight={600}>{invoice.placeOfSupply}</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Original Supply Details
                </Typography>
                <Stack spacing={1}>
                  {invoice.originalInvoiceNo && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Original Invoice:</Typography>
                      <Typography variant="body2" fontWeight={600}>{invoice.originalInvoiceNo}</Typography>
                    </Box>
                  )}
                  {invoice.originalInvoiceDate && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Original Date:</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {dayjs(invoice.originalInvoiceDate).format('DD/MM/YYYY')}
                      </Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Receipt Date:</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {dayjs(invoice.goodsReceiptDate).format('DD/MM/YYYY')}
                    </Typography>
                  </Box>
                  {invoice.serviceReceiptDate && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Service Receipt:</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {dayjs(invoice.serviceReceiptDate).format('DD/MM/YYYY')}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Party Details */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Supplier Details
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body1" fontWeight={600}>
                    {invoice.supplierName}
                  </Typography>
                  {invoice.supplierGSTIN && (
                    <Typography variant="body2" color="text.secondary">
                      GSTIN: {invoice.supplierGSTIN}
                    </Typography>
                  )}
                  {invoice.supplierPAN && (
                    <Typography variant="body2" color="text.secondary">
                      PAN: {invoice.supplierPAN}
                    </Typography>
                  )}
                  {invoice.supplierAddress && (
                    <Typography variant="body2">
                      {invoice.supplierAddress}
                    </Typography>
                  )}
                  {invoice.supplierState && (
                    <Typography variant="body2">
                      {invoice.supplierState} ({invoice.supplierStateCode})
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" color="primary" gutterBottom>
                  Recipient Details (Self)
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body1" fontWeight={600}>
                    {invoice.recipientName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    GSTIN: {invoice.recipientGSTIN}
                  </Typography>
                  {invoice.recipientAddress && (
                    <Typography variant="body2">
                      {invoice.recipientAddress}
                    </Typography>
                  )}
                  {invoice.recipientState && (
                    <Typography variant="body2">
                      {invoice.recipientState} ({invoice.recipientStateCode})
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Line Items */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" color="primary" gutterBottom>
              Item Details
            </Typography>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Description</TableCell>
                  <TableCell>HSN/SAC</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Unit</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item: any, index: any) => (
                    <TableRow key={index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.hsnSacCode}</TableCell>
                      <TableCell align="right">{Number(item.quantity).toFixed(3)}</TableCell>
                      <TableCell align="right">{item.unit}</TableCell>
                      <TableCell align="right">₹{Number(item.rate).toFixed(2)}</TableCell>
                      <TableCell align="right">₹{Number(item.amount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary" align="center">
                        No line items available - Amount details shown in tax calculation
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Tax Calculation */}
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" color="primary" gutterBottom>
              Tax Calculation
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Particulars</TableCell>
                      <TableCell align="right">Rate (%)</TableCell>
                      <TableCell align="right">Amount (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Taxable Amount</TableCell>
                      <TableCell align="right">-</TableCell>
                      <TableCell align="right">₹{Number(invoice.taxableAmount).toFixed(2)}</TableCell>
                    </TableRow>
                    
                    {invoice.cgstAmount && Number(invoice.cgstAmount) > 0 && (
                      <>
                        <TableRow>
                          <TableCell>CGST</TableCell>
                          <TableCell align="right">{Number(invoice.cgstRate).toFixed(2)}%</TableCell>
                          <TableCell align="right">₹{Number(invoice.cgstAmount).toFixed(2)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>SGST</TableCell>
                          <TableCell align="right">{Number(invoice.sgstRate).toFixed(2)}%</TableCell>
                          <TableCell align="right">₹{Number(invoice.sgstAmount).toFixed(2)}</TableCell>
                        </TableRow>
                      </>
                    )}
                    
                    {invoice.igstAmount && Number(invoice.igstAmount) > 0 && (
                      <TableRow>
                        <TableCell>IGST</TableCell>
                        <TableCell align="right">{Number(invoice.igstRate).toFixed(2)}%</TableCell>
                        <TableCell align="right">₹{Number(invoice.igstAmount).toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                    
                    {invoice.cessAmount && Number(invoice.cessAmount) > 0 && (
                      <TableRow>
                        <TableCell>CESS</TableCell>
                        <TableCell align="right">{Number(invoice.cessRate).toFixed(2)}%</TableCell>
                        <TableCell align="right">₹{Number(invoice.cessAmount).toFixed(2)}</TableCell>
                      </TableRow>
                    )}
                    
                    <TableRow>
                      <TableCell><strong>Total Tax Amount</strong></TableCell>
                      <TableCell align="right">-</TableCell>
                      <TableCell align="right"><strong>₹{Number(invoice.totalTaxAmount).toFixed(2)}</strong></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h6" gutterBottom>
                      Total Amount
                    </Typography>
                    <Typography variant="h4" fontWeight={700}>
                      ₹{Number(invoice.totalAmount).toFixed(2)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Legal Declaration */}
        <Card variant="outlined" sx={{ bgcolor: 'grey.50' }}>
          <CardContent>
            <Typography variant="h6" color="primary" gutterBottom>
              Declaration
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              This self-invoice is issued in compliance with Rule 47A of the CGST Rules, 2017, for supplies under reverse charge mechanism.
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              The tax on this supply is payable by the recipient (self) under reverse charge as per Section 9(4) of the CGST Act, 2017.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Generated on: {dayjs().format('DD/MM/YYYY HH: any:ss')}
            </Typography>
          </CardContent>
        </Card>

        {/* Footer */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            This is a system-generated self-invoice and does not require signature.
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}