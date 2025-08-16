'use client'

import React from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Divider,
  Card,
  CardContent,
  Chip,
} from '@mui/material'
import { formatINR } from '@/lib/gst'

interface GSTSummaryProps {
  taxableAmount: number
  cgstRate: number
  sgstRate: number
  igstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalGSTAmount: number
  totalAmount: number
  variant?: 'table' | 'card' | 'compact'
  showRates?: boolean
}

export function GSTSummary({
  taxableAmount,
  cgstRate,
  sgstRate,
  igstRate,
  cgstAmount,
  sgstAmount,
  igstAmount,
  totalGSTAmount,
  totalAmount,
  variant = 'table',
  showRates = true,
}: GSTSummaryProps) {
  const isInterState = igstRate > 0
  const isExempt = totalGSTAmount === 0

  if (variant === 'compact') {
    return (
      <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Taxable Amount
            </Typography>
            <Typography variant="h6">{formatINR(taxableAmount)}</Typography>
          </Box>
          {!isExempt && (
            <>
              {isInterState ? (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    IGST {showRates && `@${igstRate}%`}
                  </Typography>
                  <Typography variant="h6">{formatINR(igstAmount)}</Typography>
                </Box>
              ) : (
                <>
                  <Box sx={{ gridColumn: 'span 2', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        CGST {showRates && `@${cgstRate}%`}
                      </Typography>
                      <Typography variant="body2">{formatINR(cgstAmount)}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        SGST {showRates && `@${sgstRate}%`}
                      </Typography>
                      <Typography variant="body2">{formatINR(sgstAmount)}</Typography>
                    </Box>
                  </Box>
                </>
              )}
            </>
          )}
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body1" fontWeight={600}>
            Total Amount
          </Typography>
          <Typography variant="h5" color="primary" fontWeight={600}>
            {formatINR(totalAmount)}
          </Typography>
        </Box>
      </Box>
    )
  }

  if (variant === 'card') {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            GST Summary
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Taxable Amount:</Typography>
              <Typography fontWeight={500}>{formatINR(taxableAmount)}</Typography>
            </Box>
            {!isExempt && (
              <>
                {isInterState ? (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography>
                      IGST {showRates && `(${igstRate}%)`}:
                    </Typography>
                    <Typography fontWeight={500}>{formatINR(igstAmount)}</Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>
                        CGST {showRates && `(${cgstRate}%)`}:
                      </Typography>
                      <Typography fontWeight={500}>{formatINR(cgstAmount)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography>
                        SGST {showRates && `(${sgstRate}%)`}:
                      </Typography>
                      <Typography fontWeight={500}>{formatINR(sgstAmount)}</Typography>
                    </Box>
                  </>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography>Total GST:</Typography>
                  <Typography fontWeight={500}>{formatINR(totalGSTAmount)}</Typography>
                </Box>
              </>
            )}
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="h6">Total Amount:</Typography>
              <Typography variant="h6" color="primary">
                {formatINR(totalAmount)}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    )
  }

  // Default table variant
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell colSpan={2}>
              <Typography variant="subtitle1" fontWeight={600}>
                GST Breakup
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>Taxable Amount</TableCell>
            <TableCell align="right">{formatINR(taxableAmount)}</TableCell>
          </TableRow>
          {!isExempt && (
            <>
              {isInterState ? (
                <TableRow>
                  <TableCell>
                    IGST {showRates && `@ ${igstRate}%`}
                  </TableCell>
                  <TableCell align="right">{formatINR(igstAmount)}</TableCell>
                </TableRow>
              ) : (
                <>
                  <TableRow>
                    <TableCell>
                      CGST {showRates && `@ ${cgstRate}%`}
                    </TableCell>
                    <TableCell align="right">{formatINR(cgstAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      SGST {showRates && `@ ${sgstRate}%`}
                    </TableCell>
                    <TableCell align="right">{formatINR(sgstAmount)}</TableCell>
                  </TableRow>
                </>
              )}
              <TableRow>
                <TableCell>
                  <Typography fontWeight={500}>Total GST</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight={500}>{formatINR(totalGSTAmount)}</Typography>
                </TableCell>
              </TableRow>
            </>
          )}
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell>
              <Typography variant="subtitle1" fontWeight={600}>
                Total Amount
              </Typography>
            </TableCell>
            <TableCell align="right">
              <Typography variant="subtitle1" fontWeight={600} color="primary">
                {formatINR(totalAmount)}
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// Line items GST breakup table
interface LineItemsGSTBreakupProps {
  lineItems: Array<{
    description: string
    quantity: number
    rate: number
    amount: number
    gstRate: number
    cgstAmount?: number
    sgstAmount?: number
    igstAmount?: number
  }>
  isInterState: boolean
}

export function LineItemsGSTBreakup({
  lineItems,
  isInterState,
}: LineItemsGSTBreakupProps) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Description</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Rate</TableCell>
            <TableCell align="right">Amount</TableCell>
            <TableCell align="center">GST Rate</TableCell>
            {isInterState ? (
              <TableCell align="right">IGST</TableCell>
            ) : (
              <>
                <TableCell align="right">CGST</TableCell>
                <TableCell align="right">SGST</TableCell>
              </>
            )}
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lineItems.map((item, index) => {
            const gstAmount = isInterState 
              ? (item.igstAmount || 0)
              : (item.cgstAmount || 0) + (item.sgstAmount || 0)
            const total = item.amount + gstAmount

            return (
              <TableRow key={index}>
                <TableCell>{item.description}</TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right">{formatINR(item.rate)}</TableCell>
                <TableCell align="right">{formatINR(item.amount)}</TableCell>
                <TableCell align="center">
                  <Chip label={`${item.gstRate}%`} size="small" />
                </TableCell>
                {isInterState ? (
                  <TableCell align="right">{formatINR(item.igstAmount || 0)}</TableCell>
                ) : (
                  <>
                    <TableCell align="right">{formatINR(item.cgstAmount || 0)}</TableCell>
                    <TableCell align="right">{formatINR(item.sgstAmount || 0)}</TableCell>
                  </>
                )}
                <TableCell align="right">
                  <Typography fontWeight={500}>{formatINR(total)}</Typography>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}