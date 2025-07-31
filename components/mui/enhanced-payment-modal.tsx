'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Typography,
  Alert,
  Paper,
  Chip,
  FormHelperText,
  LinearProgress,
  Grid,
  Tabs,
  Tab,
  Divider,
  CircularProgress,
} from '@mui/material'
import { Stack } from '@mui/material'
import {
  Info as InfoIcon,
  AccountBalance as BankIcon,
  Receipt as ReceiptIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { api } from '@/lib/trpc/client'
import { enqueueSnackbar } from 'notistack'
import { FileUpload } from './file-upload'

interface PaymentModalProps {
  invoiceId: string
  invoiceNumber: string
  currency: string
  totalAmount: number
  amountPaid: number
  balanceDue: number
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const paymentMethods = [
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CREDIT_CARD', label: 'Credit Card' },
  { value: 'DEBIT_CARD', label: 'Debit Card' },
  { value: 'UPI', label: 'UPI' },
  { value: 'PAYPAL', label: 'PayPal' },
  { value: 'PAYONEER', label: 'Payoneer' },
  { value: 'WISE', label: 'Wise (TransferWise)' },
  { value: 'OTHER', label: