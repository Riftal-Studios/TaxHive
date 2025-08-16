'use client'

import { useState } from 'react'
import { api } from '@/lib/trpc/client'
import { formatINR } from '@/lib/gst'
import Link from 'next/link'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Chip,
  Stack,
  CircularProgress
} from '@mui/material'
import Grid from '@mui/material/Grid'
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Receipt as ReceiptIcon,
  Description as DescriptionIcon
} from '@mui/icons-material'
import { CREDIT_NOTE_REASONS, DEBIT_NOTE_REASONS } from '@/lib/credit-debit-notes'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  )
}

export default function CreditDebitNotesPage() {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'CANCELLED'>('ALL')
  const [activeTab, setActiveTab] = useState(0)

  // Fetch credit notes
  const { data: creditNotes, isLoading: creditLoading } = api.creditDebitNotes.getAllCreditNotes.useQuery(
    statusFilter === 'ALL' ? undefined : { status: statusFilter as any }
  )

  // Fetch debit notes
  const { data: debitNotes, isLoading: debitLoading } = api.creditDebitNotes.getAllDebitNotes.useQuery(
    statusFilter === 'ALL' ? undefined : { status: statusFilter as any }
  )

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusChip = (status: string) => {
    const statusConfig: any = {
      DRAFT: { color: 'default' as const, label: 'Draft' },
      ISSUED: { color: 'success' as const, label: 'Issued' },
      CANCELLED: { color: 'error' as const, label: 'Cancelled' }
    }
    const config = statusConfig[status]
    return <Chip size="small" color={config?.color} label={config?.label || status} />
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">Credit & Debit Notes</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage invoice adjustments and corrections
          </Typography>
        </Box>
        <Link href="/notes/new" passHref legacyBehavior>
          <Button variant="contained" startIcon={<AddIcon />}>
            Create Note
          </Button>
        </Link>
      </Stack>

      {/* Main Content */}
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Notes Management</Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Status Filter</InputLabel>
              <Select
                value={statusFilter}
                label="Status Filter"
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <MenuItem value="ALL">All Status</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="ISSUED">Issued</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab 
              icon={<ReceiptIcon />} 
              label={`Credit Notes (${creditNotes?.length || 0})`}
              iconPosition="start"
            />
            <Tab 
              icon={<DescriptionIcon />} 
              label={`Debit Notes (${debitNotes?.length || 0})`}
              iconPosition="start"
            />
          </Tabs>

          <TabPanel value={activeTab} index={0}>
            {creditLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : creditNotes?.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography color="text.secondary">No credit notes found</Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Note Number</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Original Invoice</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {creditNotes?.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell>{note.noteNumber}</TableCell>
                        <TableCell>{formatDate(note.noteDate)}</TableCell>
                        <TableCell>
                          <Link href={`/invoices/${note.originalInvoiceId}`} passHref legacyBehavior>
                            <Typography
                              component="a"
                              color="primary"
                              sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {note.originalInvoice.invoiceNumber}
                            </Typography>
                          </Link>
                        </TableCell>
                        <TableCell>{note.originalInvoice.client.name}</TableCell>
                        <TableCell>{CREDIT_NOTE_REASONS[note.reason as keyof typeof CREDIT_NOTE_REASONS]}</TableCell>
                        <TableCell align="right">{formatINR(Number(note.totalDiff))}</TableCell>
                        <TableCell>{getStatusChip(note.status)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Link href={`/notes/credit/${note.id}`} passHref legacyBehavior>
                              <IconButton size="small">
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Link>
                            {note.pdfUrl && (
                              <IconButton size="small">
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            {debitLoading ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : debitNotes?.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography color="text.secondary">No debit notes found</Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Note Number</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Original Invoice</TableCell>
                      <TableCell>Client</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {debitNotes?.map((note) => (
                      <TableRow key={note.id}>
                        <TableCell>{note.noteNumber}</TableCell>
                        <TableCell>{formatDate(note.noteDate)}</TableCell>
                        <TableCell>
                          <Link href={`/invoices/${note.originalInvoiceId}`} passHref legacyBehavior>
                            <Typography
                              component="a"
                              color="primary"
                              sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                            >
                              {note.originalInvoice.invoiceNumber}
                            </Typography>
                          </Link>
                        </TableCell>
                        <TableCell>{note.originalInvoice.client.name}</TableCell>
                        <TableCell>{DEBIT_NOTE_REASONS[note.reason as keyof typeof DEBIT_NOTE_REASONS]}</TableCell>
                        <TableCell align="right">{formatINR(Number(note.totalDiff))}</TableCell>
                        <TableCell>{getStatusChip(note.status)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Link href={`/notes/debit/${note.id}`} passHref legacyBehavior>
                              <IconButton size="small">
                                <ViewIcon fontSize="small" />
                              </IconButton>
                            </Link>
                            {note.pdfUrl && (
                              <IconButton size="small">
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Total Credit Notes
              </Typography>
              <Typography variant="h4">
                {formatINR(
                  creditNotes?.reduce((sum, note) => 
                    note.status === 'ISSUED' ? sum + Number(note.totalDiff) : sum, 0) || 0
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {creditNotes?.filter(n => n.status === 'ISSUED').length || 0} issued notes
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Total Debit Notes
              </Typography>
              <Typography variant="h4">
                {formatINR(
                  debitNotes?.reduce((sum, note) => 
                    note.status === 'ISSUED' ? sum + Number(note.totalDiff) : sum, 0) || 0
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {debitNotes?.filter(n => n.status === 'ISSUED').length || 0} issued notes
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Net Adjustment
              </Typography>
              <Typography variant="h4">
                {formatINR(
                  (debitNotes?.reduce((sum, note) => 
                    note.status === 'ISSUED' ? sum + Number(note.totalDiff) : sum, 0) || 0) -
                  (creditNotes?.reduce((sum, note) => 
                    note.status === 'ISSUED' ? sum + Number(note.totalDiff) : sum, 0) || 0)
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Debit notes minus credit notes
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}