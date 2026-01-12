'use client'

import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Container,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Grid,
  Chip,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Receipt as InvoiceIcon,
} from '@mui/icons-material'
import { api } from '@/lib/trpc/client'
import { format } from 'date-fns'
import { formatCurrency } from '@/lib/invoice-utils'
import { toSafeNumber } from '@/lib/utils/decimal'

export default function SupplierDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: supplier, isLoading, error } = api.unregisteredSuppliers.getById.useQuery({ id })

  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Error loading supplier: {error.message}
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/suppliers')}
        >
          Back to Suppliers
        </Button>
      </Container>
    )
  }

  if (!supplier) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Supplier not found
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => router.push('/suppliers')}
        >
          Back to Suppliers
        </Button>
      </Container>
    )
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Button
            startIcon={<BackIcon />}
            onClick={() => router.push('/suppliers')}
            sx={{ mb: 2 }}
          >
            Back to Suppliers
          </Button>
          <Typography variant="h4" component="h1" fontWeight={600}>
            {supplier.name}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Unregistered Supplier
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<InvoiceIcon />}
            onClick={() => router.push('/self-invoices/new')}
          >
            Create Self Invoice
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => router.push(`/suppliers/${supplier.id}/edit`)}
          >
            Edit
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Status */}
        <Grid size={{ xs: 12 }}>
          <Chip
            label={supplier.isActive ? 'Active' : 'Inactive'}
            color={supplier.isActive ? 'success' : 'default'}
            variant="outlined"
          />
        </Grid>

        {/* Supplier Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Supplier Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary">
                  Name
                </Typography>
                <Typography variant="body1" fontWeight={500}>
                  {supplier.name}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary">
                  Address
                </Typography>
                <Typography variant="body1">
                  {supplier.address}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  State
                </Typography>
                <Typography variant="body1">
                  {supplier.state}
                </Typography>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" color="text.secondary">
                  State Code
                </Typography>
                <Typography variant="body1">
                  {supplier.stateCode}
                </Typography>
              </Grid>
              {supplier.pincode && (
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    Pincode
                  </Typography>
                  <Typography variant="body1">
                    {supplier.pincode}
                  </Typography>
                </Grid>
              )}
              {supplier.pan && (
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    PAN
                  </Typography>
                  <Typography variant="body1">
                    {supplier.pan}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Paper>
        </Grid>

        {/* Contact Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Contact Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary">
                  Phone
                </Typography>
                <Typography variant="body1">
                  {supplier.phone || 'Not provided'}
                </Typography>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="text.secondary">
                  Email
                </Typography>
                <Typography variant="body1">
                  {supplier.email || 'Not provided'}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Recent Self Invoices */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Self Invoices
              </Typography>
              <Button
                size="small"
                onClick={() => router.push(`/self-invoices?supplier=${supplier.id}`)}
              >
                View All
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {supplier.invoices && supplier.invoices.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Invoice #</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {supplier.invoices.slice(0, 5).map((invoice) => (
                      <TableRow key={invoice.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {invoice.invoiceNumber}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.invoiceDate), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(toSafeNumber(invoice.totalAmount), 'INR')}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase()}
                            size="small"
                            color={invoice.status === 'FINALIZED' ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            onClick={() => router.push(`/self-invoices/${invoice.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box py={4} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  No self-invoices yet for this supplier
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<InvoiceIcon />}
                  sx={{ mt: 2 }}
                  onClick={() => router.push('/self-invoices/new')}
                >
                  Create Self Invoice
                </Button>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Metadata */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Created: {format(new Date(supplier.createdAt), 'dd MMM yyyy, HH:mm')}
              {' • '}
              Last Updated: {format(new Date(supplier.updatedAt), 'dd MMM yyyy, HH:mm')}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  )
}
