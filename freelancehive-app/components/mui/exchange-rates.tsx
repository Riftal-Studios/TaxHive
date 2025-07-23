'use client'

import React from 'react'
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Skeleton,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { format } from 'date-fns'
import { enqueueSnackbar } from 'notistack'

export function MUIExchangeRates() {
  const utils = api.useUtils()
  const { data: exchangeRates, isLoading } = api.admin.getLatestExchangeRates.useQuery()
  
  const updateExchangeRatesMutation = api.admin.updateExchangeRates.useMutation({
    onSuccess: () => {
      utils.admin.getLatestExchangeRates.invalidate()
      enqueueSnackbar('Exchange rates updated successfully!', { variant: 'success' })
    },
    onError: (error) => {
      enqueueSnackbar(error.message || 'Failed to update exchange rates', { variant: 'error' })
    },
  })

  const handleUpdateExchangeRates = async () => {
    await updateExchangeRatesMutation.mutateAsync()
  }

  if (isLoading) {
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="text" width={400} height={24} />
          </Box>
          <Skeleton variant="rectangular" width={120} height={36} />
        </Box>
        <Skeleton variant="rectangular" height={400} />
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h6" gutterBottom>
            Exchange Rates
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Daily exchange rates are automatically updated at 9:00 AM IST
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={handleUpdateExchangeRates}
          disabled={updateExchangeRatesMutation.isPending}
          startIcon={
            updateExchangeRatesMutation.isPending ? 
            <CircularProgress size={20} /> : 
            <RefreshIcon />
          }
        >
          {updateExchangeRatesMutation.isPending ? 'Updating...' : 'Update Now'}
        </Button>
      </Box>

      {exchangeRates?.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No exchange rates available
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Click "Update Now" to fetch the latest rates
          </Typography>
          <Button
            variant="contained"
            onClick={handleUpdateExchangeRates}
            disabled={updateExchangeRatesMutation.isPending}
            startIcon={
              updateExchangeRatesMutation.isPending ? 
              <CircularProgress size={20} /> : 
              <RefreshIcon />
            }
          >
            {updateExchangeRatesMutation.isPending ? 'Updating...' : 'Fetch Exchange Rates'}
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Currency</TableCell>
                <TableCell>Rate (1 = ₹)</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Last Updated</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exchangeRates?.map((rate) => (
                <TableRow key={rate.id}>
                  <TableCell>
                    <Typography variant="body1" fontWeight={500}>
                      {rate.currency}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body1">
                      ₹{Number(rate.rate).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={rate.source} 
                      size="small" 
                      color={rate.source === 'RBI' ? 'success' : 'default'}
                      variant={rate.source === 'RBI' ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {format(new Date(rate.createdAt), 'dd MMM yyyy, hh:mm a')}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Info Alert */}
      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Note:</strong> Exchange rates are sourced from the Reserve Bank of India (RBI) when available. 
          If RBI rates are unavailable, we use ExchangeRatesAPI as a fallback. 
          Rates are automatically updated daily at 9:00 AM IST.
        </Typography>
      </Alert>
    </Box>
  )
}