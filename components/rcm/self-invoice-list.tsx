'use client'

import React, { useState, useEffect } from 'react'
import { api } from '@/lib/trpc/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import {
  Visibility as Eye,
  Download,
  Email as Mail,
  Close as X,
  ChevronLeft,
  ChevronRight,
  Refresh as RefreshCw,
  Description as FileText,
} from '@mui/icons-material'
import { CircularProgress } from '@mui/material'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SelfInvoice {
  id: string
  invoiceNumber: string
  invoiceDate: Date
  supplier: {
    name: string
    gstin: string
  }
  serviceType: {
    name: string
    sacCode: string
  }
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalAmount: number
  status: 'GENERATED' | 'CANCELLED'
  createdAt: Date
}

export function SelfInvoiceList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [showEmailDialog, setShowEmailDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [emailDialogInvoiceId, setEmailDialogInvoiceId] = useState<string>('')
  const [cancelDialogInvoiceId, setCancelDialogInvoiceId] = useState<string>('')
  const [emailAddress, setEmailAddress] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const itemsPerPage = 10

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Build query filters
  const filters = {
    page,
    limit: itemsPerPage,
    search: debouncedSearch,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  // Fetch self-invoices
  const { data, isLoading, error, refetch } = api.rcm.getSelfInvoices.useQuery(filters)

  // Mutations
  const downloadSelfInvoice = api.rcm.downloadSelfInvoice.useMutation({
    onSuccess: (result) => {
      // Create a blob URL and trigger download
      const link = document.createElement('a')
      link.href = result.url
      link.download = `self-invoice-${result.id}.pdf`
      link.click()
      toast.success('Invoice downloaded successfully')
    },
    onError: (error) => {
      toast.error(`Failed to download invoice: ${error.message}`)
    },
  })

  const emailSelfInvoice = api.rcm.emailSelfInvoice.useMutation({
    onSuccess: () => {
      toast.success('Invoice sent successfully')
      setShowEmailDialog(false)
      setEmailAddress('')
    },
    onError: (error) => {
      toast.error(`Failed to send invoice: ${error.message}`)
    },
  })

  const cancelSelfInvoice = api.rcm.cancelSelfInvoice.useMutation({
    onSuccess: () => {
      toast.success('Invoice cancelled successfully')
      setShowCancelDialog(false)
      refetch()
    },
    onError: (error) => {
      toast.error(`Failed to cancel invoice: ${error.message}`)
    },
  })

  // Handle actions
  const handleView = (id: string) => {
    router.push(`/rcm/self-invoice/${id}`)
  }

  const handleDownload = async (id: string) => {
    await downloadSelfInvoice.mutateAsync({ id })
  }

  const handleEmail = (id: string) => {
    setEmailDialogInvoiceId(id)
    setShowEmailDialog(true)
  }

  const handleCancel = (id: string) => {
    setCancelDialogInvoiceId(id)
    setShowCancelDialog(true)
  }

  const handleSendEmail = async () => {
    if (!emailAddress) {
      toast.error('Please enter an email address')
      return
    }
    await emailSelfInvoice.mutateAsync({
      id: emailDialogInvoiceId,
      email: emailAddress,
    })
  }

  const handleConfirmCancel = async () => {
    await cancelSelfInvoice.mutateAsync({ id: cancelDialogInvoiceId })
  }

  const handleBulkDownload = async () => {
    for (const id of selectedInvoices) {
      await downloadSelfInvoice.mutateAsync({ id })
    }
    setSelectedInvoices([])
  }

  const handleBulkEmail = () => {
    // For simplicity, we'll handle bulk email one by one
    // In a real implementation, you might want a different UI for bulk email
    toast.info('Bulk email feature coming soon')
  }

  const toggleSelectAll = () => {
    if (!data?.invoices) return
    
    if (selectedInvoices.length === data.invoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(data.invoices.map(inv => inv.id))
    }
  }

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    )
  }

  const totalPages = data ? Math.ceil(data.total / itemsPerPage) : 1

  // Format currency
  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`
  }

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <CircularProgress size={32} className="mr-2" />
          <span>Loading self-invoices...</span>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertDescription>Failed to load self-invoices: {error.message}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (!data?.invoices || data.invoices.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No self-invoices found</h3>
          <p className="text-gray-500 mb-4">Create your first self-invoice to get started</p>
          <Button onClick={() => router.push('/rcm/create')}>
            Create Self-Invoice
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Self-Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <Input
                placeholder="Search by invoice number or supplier"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger aria-label="Status filter">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Status</SelectItem>
                  <SelectItem value="GENERATED">Generated</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                placeholder="Date from"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Date from"
              />
              <Input
                type="date"
                placeholder="Date to"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Date to"
              />
            </div>

            {/* Bulk actions */}
            {selectedInvoices.length > 0 && (
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium">{selectedInvoices.length} selected</span>
                <Button size="sm" variant="outline" onClick={handleBulkDownload}>
                  Bulk Download
                </Button>
                <Button size="sm" variant="outline" onClick={handleBulkEmail}>
                  Bulk Email
                </Button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedInvoices.length === data.invoices.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Invoice Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Taxable Amount</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={() => toggleSelectInvoice(invoice.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{format(new Date(invoice.invoiceDate), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <div>
                        <div>{invoice.supplier.name}</div>
                        <div className="text-xs text-gray-500">{invoice.supplier.gstin}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div>{invoice.serviceType.name}</div>
                        <div className="text-xs text-gray-500">SAC: {invoice.serviceType.sacCode}</div>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(invoice.taxableAmount)}</TableCell>
                    <TableCell>
                      {invoice.cgstAmount > 0 ? (
                        <div>
                          <div className="text-xs">CGST: {formatCurrency(invoice.cgstAmount)}</div>
                          <div className="text-xs">SGST: {formatCurrency(invoice.sgstAmount)}</div>
                        </div>
                      ) : (
                        <div className="text-xs">IGST: {formatCurrency(invoice.igstAmount)}</div>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={invoice.status === 'GENERATED' ? 'default' : 'destructive'}
                        className={invoice.status === 'CANCELLED' ? 'bg-red-100' : ''}
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleView(invoice.id)}
                          aria-label="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDownload(invoice.id)}
                          disabled={invoice.status === 'CANCELLED'}
                          aria-label="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEmail(invoice.id)}
                          disabled={invoice.status === 'CANCELLED'}
                          aria-label="Email"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancel(invoice.id)}
                          disabled={invoice.status === 'CANCELLED'}
                          aria-label="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Self-Invoice</DialogTitle>
            <DialogDescription>
              Enter the email address to send the invoice to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="example@email.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={emailSelfInvoice.isLoading}>
              {emailSelfInvoice.isLoading ? (
                <>
                  <CircularProgress size={16} className="mr-2" />
                  Sending...
                </>
              ) : (
                'Send'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Self-Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this self-invoice? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmCancel}
              disabled={cancelSelfInvoice.isLoading}
            >
              {cancelSelfInvoice.isLoading ? (
                <>
                  <CircularProgress size={16} className="mr-2" />
                  Cancelling...
                </>
              ) : (
                'Confirm'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}