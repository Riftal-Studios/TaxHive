'use client'

import React, { useState, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  TextField,
  Button,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogContent,
  InputAdornment,
  Stack,
} from '@mui/material'
import {
  DataGrid,
  GridColDef,
  GridActionsCellItem,
  GridRowParams,
  GridToolbar,
} from '@mui/x-data-grid'
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  GetApp as DownloadIcon,
  Print as PrintIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import dayjs, { Dayjs } from 'dayjs'
import { trpc } from '@/lib/trpc/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { SelfInvoicePreview } from './self-invoice-preview'

interface SelfInvoiceListProps {
  showHeader?: boolean
  maxHeight?: number
}

const STATUS_COLORS = {
  DRAFT: 'default',
  ISSUED: 'success',
  CANCELLED: 'error',
} as const

const COMPLIANCE_STATUS_COLORS = {
  ON_TIME: 'success',
  DELAYED: 'error',
  WARNING: 'warning',
} as const

export function SelfInvoiceList({ showHeader = true, maxHeight = 600 }: SelfInvoiceListProps) {
  const router = useRouter()
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [complianceFilter, setComplianceFilter] = useState<string>('')
  const [dateRange, setDateRange] = useState<{
    start: any | null
    end: any | null
  }>({
    start: any,
    end: any,
  })
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Fetch self-invoices
  const { data, isLoading, refetch } = trpc.rcm.listSelfInvoices.useQuery({
    limit: 100,
    status: any as 'ISSUED' | 'CANCELLED' | 'DRAFT' | undefined,
    startDate: any.start?.toDate(),
    endDate: any.end?.toDate(),
  })
  
  const selfInvoices = data?.selfInvoices || []

  // Download PDF mutation
  const downloadPDF = trpc.rcm.downloadSelfInvoicePDF.useMutation({
    onSuccess: (data: any) => {
      // Create blob and download
      const blob = new Blob([data.pdf], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${data.filename}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('PDF downloaded successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to download PDF')
    },
  })

  // Filtered and processed data
  const processedData = useMemo(() => {
    return selfInvoices.map((invoice: any) => {
      const daysSinceReceipt = dayjs().diff(dayjs(invoice.goodsReceiptDate), 'day')
      const isOverdue = daysSinceReceipt > 30
      const isWarning = daysSinceReceipt > 25 && daysSinceReceipt <= 30
      
      let complianceStatus = 'ON_TIME'
      if (isOverdue) {
        complianceStatus = 'DELAYED'
      } else if (isWarning) {
        complianceStatus = 'WARNING'
      }

      return {
        ...invoice,
        complianceStatus,
        daysSinceReceipt,
        isOverdue,
        formattedInvoiceDate: any(invoice.invoiceDate).format('DD/MM/YYYY'),
        formattedReceiptDate: any(invoice.goodsReceiptDate).format('DD/MM/YYYY'),
        formattedTaxableAmount: any(invoice.taxableAmount).toFixed(2),
        formattedTotalAmount: any(invoice.totalAmount).toFixed(2),
      }
    })
  }, [selfInvoices])

  const handleViewInvoice = (invoice: any) => {
    setSelectedInvoice(invoice)
    setPreviewOpen(true)
  }

  const handleDownloadPDF = (invoice: any) => {
    downloadPDF.mutate({ invoiceId: any.id } as any)
  }

  const handlePrintInvoice = (invoice: any) => {
    // Open in new window for printing
    const printWindow = window.open(`/rcm/self-invoice/${invoice.id}/print`, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  const getComplianceIcon = (status: any) => {
    switch (status) {
      case 'ON_TIME':
        return <CheckCircleIcon color="success" fontSize="small" />
      case 'WARNING':
        return <ScheduleIcon color="warning" fontSize="small" />
      case 'DELAYED':
        return <WarningIcon color="error" fontSize="small" />
      default:
        return null
    }
  }

  const getComplianceText = (invoice: any) => {
    switch (invoice.complianceStatus) {
      case 'ON_TIME':
        return `On time (${30 - invoice.daysSinceReceipt} days remaining)`
      case 'WARNING':
        return `Due soon (${30 - invoice.daysSinceReceipt} days remaining)`
      case 'DELAYED':
        return `Overdue by ${invoice.daysSinceReceipt - 30} days`
      default:
        return 'Unknown'
    }
  }

  const columns: any[] = [
    {
      field: 'invoiceNumber',
      headerName: 'Invoice Number',
      width: 180,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon fontSize="small" color="primary" />
          <Typography variant="body2" fontWeight={500}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'formattedInvoiceDate',
      headerName: 'Invoice Date',
      width: 120,
    },
    {
      field: 'supplierName',
      headerName: 'Supplier',
      width: 200,
      renderCell: (params: any) => (
        <Box>
          <Typography variant="body2" fontWeight={500}>
            {params.value}
          </Typography>
          {params.row.supplierGSTIN && (
            <Typography variant="caption" color="text.secondary">
              GSTIN: {params.row.supplierGSTIN}
            </Typography>
          )}
        </Box>
      ),
    },
    {
      field: 'rcmType',
      headerName: 'RCM Type',
      width: 150,
      renderCell: (params: any) => {
        const typeLabels = {
          UNREGISTERED: 'Unregistered',
          IMPORT_SERVICE: 'Import Service',
          NOTIFIED_SERVICE: 'Notified Service',
          NOTIFIED_GOODS: 'Notified Goods',
        }
        return (
          <Chip
            label={typeLabels[params.value as keyof typeof typeLabels] || params.value}
            size="small"
            variant="outlined"
            color="primary"
          />
        )
      },
    },
    {
      field: 'formattedTaxableAmount',
      headerName: 'Taxable Amount',
      width: 130,
      type: 'number',
      renderCell: (params: any) => (
        <Typography variant="body2" fontWeight={500}>
          ₹{params.value}
        </Typography>
      ),
    },
    {
      field: 'formattedTotalAmount',
      headerName: 'Total Amount',
      width: 130,
      type: 'number',
      renderCell: (params: any) => (
        <Typography variant="body2" fontWeight={500} color="primary">
          ₹{params.value}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params: any) => (
        <Chip
          label={params.value}
          size="small"
          color={STATUS_COLORS[params.value as keyof typeof STATUS_COLORS]}
        />
      ),
    },
    {
      field: 'complianceStatus',
      headerName: 'Compliance',
      width: 200,
      renderCell: (params: any) => (
        <Tooltip title={getComplianceText(params.row)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getComplianceIcon(params.value)}
            <Typography variant="caption">
              {params.row.complianceStatus === 'ON_TIME' ? 'On Time' :
               params.row.complianceStatus === 'WARNING' ? 'Due Soon' :
               'Overdue'}
            </Typography>
          </Box>
        </Tooltip>
      ),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 150,
      getActions: (params: any) => [
        <GridActionsCellItem
          key="view"
          icon={
            <Tooltip title="View Details">
              <ViewIcon />
            </Tooltip>
          }
          label="View"
          onClick={() => handleViewInvoice(params.row)}
        />,
        <GridActionsCellItem
          key="download"
          icon={
            <Tooltip title="Download PDF">
              <DownloadIcon />
            </Tooltip>
          }
          label="Download"
          onClick={() => handleDownloadPDF(params.row)}
          disabled={downloadPDF.isLoading}
        />,
        <GridActionsCellItem
          key="print"
          icon={
            <Tooltip title="Print">
              <PrintIcon />
            </Tooltip>
          }
          label="Print"
          onClick={() => handlePrintInvoice(params.row)}
        />,
      ],
    },
  ]

  const clearFilters = () => {
    setSearchText('')
    setStatusFilter('')
    setComplianceFilter('')
    setDateRange({ start: any, end: any })
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        {showHeader && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" component="h1">
                Self-Invoices
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => router.push('/rcm/self-invoice/new')}
                size="large"
              >
                Generate New
              </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              Self-invoices must be generated within 30 days of goods/service receipt as per GST Rule 47A.
              Overdue invoices may attract interest and penalty.
            </Alert>
          </Box>
        )}

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardHeader
            title="Filters"
            action={
              <Button
                variant="outlined"
                onClick={clearFilters}
                size="small"
              >
                Clear All
              </Button>
            }
          />
          <CardContent>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }} md={3}>
                <TextField
                  fullWidth
                  label="Search"
                  value={searchText}
                  onChange={(e: any) => setSearchText(e.target.value)}
                  placeholder="Invoice number, supplier..."
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid size={{ xs: 12 }} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="DRAFT">Draft</MenuItem>
                    <MenuItem value="ISSUED">Issued</MenuItem>
                    <MenuItem value="CANCELLED">Cancelled</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Compliance</InputLabel>
                  <Select
                    value={complianceFilter}
                    label="Compliance"
                    onChange={(e: any) => setComplianceFilter(e.target.value)}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="ON_TIME">On Time</MenuItem>
                    <MenuItem value="WARNING">Due Soon</MenuItem>
                    <MenuItem value="DELAYED">Overdue</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }} md={2.5}>
                <DatePicker
                  label="From Date"
                  value={dateRange.start}
                  onChange={(value: any) => setDateRange(prev => ({ ...prev, start: any }))}
                  sx={{ width: '100%' }}
                />
              </Grid>

              <Grid size={{ xs: 12 }} md={2.5}>
                <DatePicker
                  label="To Date"
                  value={dateRange.end}
                  onChange={(value: any) => setDateRange(prev => ({ ...prev, end: any }))}
                  sx={{ width: '100%' }}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Data Grid */}
        <Card>
          <Box sx={{ height: any, width: '100%' }}>
            <DataGrid
              rows={processedData}
              columns={columns}
              loading={isLoading}
              slots={{ toolbar: any }}
              slotProps={{
                toolbar: {
                  showQuickFilter: any,
                  quickFilterProps: { debounceMs: 500 },
                },
              }}
              pageSizeOptions={[25, 50, 100]}
              initialState={{
                pagination: {
                  paginationModel: { pageSize: 25 },
                },
                sorting: {
                  sortModel: [{ field: 'invoiceDate', sort: 'desc' }],
                },
              }}
              checkboxSelection
              disableRowSelectionOnClick
              sx={{
                '& .MuiDataGrid-row': {
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                },
                '& .MuiDataGrid-cell': {
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                },
              }}
            />
          </Box>
        </Card>

        {/* Preview Dialog */}
        <Dialog
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogContent sx={{ p: 0 }}>
            {selectedInvoice && (
              <SelfInvoicePreview
                invoice={selectedInvoice}
                onClose={() => setPreviewOpen(false)}
                onDownload={() => handleDownloadPDF(selectedInvoice)}
                onPrint={() => handlePrintInvoice(selectedInvoice)}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </LocalizationProvider>
  )
}