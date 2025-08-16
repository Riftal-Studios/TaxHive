"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import { Button, Paper, IconButton, Chip, Snackbar, Alert } from "@mui/material"
import { DataGrid, GridColDef } from "@mui/x-data-grid"
import { Add, Edit, Delete, Visibility, CheckCircle, Cancel } from "@mui/icons-material"
import Link from "next/link"
import { format } from "date-fns"

export default function PurchaseInvoicesPage() {
  const router = useRouter()
  const [purchases, setPurchases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  })
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })
  
  const { data, refetch } = api.purchaseInvoices.getAll.useQuery({
    page: paginationModel.page + 1,
    limit: paginationModel.pageSize,
  })
  
  const deleteMutation = api.purchaseInvoices.delete.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: "Purchase invoice deleted successfully",
        severity: 'success'
      })
      refetch()
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: `Failed to delete invoice: ${error.message}`,
        severity: 'error'
      })
    }
  })
  
  useEffect(() => {
    if (data) {
      setPurchases(data.purchases || [])
      setLoading(false)
    }
  }, [data])
  
  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this purchase invoice?")) {
      await deleteMutation.mutateAsync(id)
    }
  }
  
  const columns: GridColDef[] = [
    {
      field: "invoiceNumber",
      headerName: "Invoice Number",
      width: 150,
      renderCell: (params) => (
        <Link href={`/purchases/${params.row.id}`} className="text-blue-600 hover:underline">
          {params.value}
        </Link>
      )
    },
    {
      field: "vendor",
      headerName: "Vendor",
      width: 200,
      renderCell: (params) => params.row.vendor?.name || ""
    },
    {
      field: "invoiceDate",
      headerName: "Invoice Date",
      width: 120,
      valueFormatter: (params) => {
        return params ? format(new Date(params), "dd/MM/yyyy") : ""
      }
    },
    {
      field: "taxableAmount",
      headerName: "Taxable Amount",
      width: 130,
      align: "right",
      valueFormatter: (params) => `₹${Number(params || 0).toFixed(2)}`
    },
    {
      field: "totalGSTAmount",
      headerName: "GST Amount",
      width: 120,
      align: "right",
      valueFormatter: (params) => `₹${Number(params || 0).toFixed(2)}`
    },
    {
      field: "totalAmount",
      headerName: "Total Amount",
      width: 130,
      align: "right",
      valueFormatter: (params) => `₹${Number(params || 0).toFixed(2)}`
    },
    {
      field: "itcClaimed",
      headerName: "ITC Claimed",
      width: 120,
      align: "right",
      renderCell: (params) => (
        <span className={params.value > 0 ? "text-green-600 font-semibold" : ""}>
          ₹{Number(params.value || 0).toFixed(2)}
        </span>
      )
    },
    {
      field: "itcCategory",
      headerName: "ITC Category",
      width: 120,
      renderCell: (params) => {
        const categoryColors: Record<string, "default" | "primary" | "secondary" | "error" | "warning" | "info" | "success"> = {
          INPUTS: "primary",
          CAPITAL_GOODS: "secondary",
          INPUT_SERVICES: "info",
          BLOCKED: "error"
        }
        return (
          <Chip
            label={params.value}
            size="small"
            color={categoryColors[params.value] || "default"}
          />
        )
      }
    },
    {
      field: "matchStatus",
      headerName: "GSTR-2A Status",
      width: 130,
      renderCell: (params) => {
        const statusIcons = {
          MATCHED: <CheckCircle className="text-green-600" fontSize="small" />,
          MISMATCHED: <Cancel className="text-red-600" fontSize="small" />,
          NOT_AVAILABLE: <Cancel className="text-gray-400" fontSize="small" />
        }
        const statusLabels = {
          MATCHED: "Matched",
          MISMATCHED: "Mismatched",
          NOT_AVAILABLE: "Not Available"
        }
        return (
          <div className="flex items-center gap-1">
            {statusIcons[params.value as keyof typeof statusIcons]}
            <span className="text-sm">{statusLabels[params.value as keyof typeof statusLabels]}</span>
          </div>
        )
      }
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <div className="flex gap-1">
          <IconButton
            size="small"
            onClick={() => router.push(`/purchases/${params.row.id}`)}
            title="View"
          >
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => router.push(`/purchases/${params.row.id}/edit`)}
            title="Edit"
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
            title="Delete"
            className="text-red-600"
          >
            <Delete fontSize="small" />
          </IconButton>
        </div>
      )
    }
  ]
  
  // Calculate ITC Summary
  const itcSummary = purchases.reduce((acc, purchase) => {
    acc.totalITC += Number(purchase.totalGSTAmount || 0)
    acc.claimedITC += Number(purchase.itcClaimed || 0)
    acc.blockedITC += Number(purchase.totalGSTAmount || 0) - Number(purchase.itcClaimed || 0)
    acc.reversedITC += Number(purchase.itcReversed || 0)
    
    if (purchase.matchStatus === "MATCHED") {
      acc.matchedCount++
    } else if (purchase.matchStatus === "MISMATCHED") {
      acc.mismatchedCount++
    } else {
      acc.notAvailableCount++
    }
    
    return acc
  }, {
    totalITC: 0,
    claimedITC: 0,
    blockedITC: 0,
    reversedITC: 0,
    matchedCount: 0,
    mismatchedCount: 0,
    notAvailableCount: 0
  })
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Invoices</h1>
          <p className="text-gray-600 mt-2">Manage purchase invoices and track Input Tax Credit</p>
        </div>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => router.push("/purchases/new")}
        >
          New Purchase Invoice
        </Button>
      </div>
      
      {/* ITC Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Paper className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">Total GST on Purchases</h3>
          <p className="text-2xl font-bold text-gray-900">₹{itcSummary.totalITC.toFixed(2)}</p>
        </Paper>
        <Paper className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">ITC Claimed</h3>
          <p className="text-2xl font-bold text-green-600">₹{itcSummary.claimedITC.toFixed(2)}</p>
        </Paper>
        <Paper className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">ITC Blocked</h3>
          <p className="text-2xl font-bold text-red-600">₹{itcSummary.blockedITC.toFixed(2)}</p>
        </Paper>
        <Paper className="p-4">
          <h3 className="text-sm font-medium text-gray-600 mb-2">ITC Reversed</h3>
          <p className="text-2xl font-bold text-orange-600">₹{itcSummary.reversedITC.toFixed(2)}</p>
        </Paper>
      </div>
      
      {/* GSTR-2A Matching Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Paper className="p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600">Matched with GSTR-2A</h3>
              <p className="text-xl font-bold text-gray-900">{itcSummary.matchedCount}</p>
            </div>
            <CheckCircle className="text-green-600" />
          </div>
        </Paper>
        <Paper className="p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600">Mismatched</h3>
              <p className="text-xl font-bold text-gray-900">{itcSummary.mismatchedCount}</p>
            </div>
            <Cancel className="text-red-600" />
          </div>
        </Paper>
        <Paper className="p-4 border-l-4 border-gray-400">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600">Not Available</h3>
              <p className="text-xl font-bold text-gray-900">{itcSummary.notAvailableCount}</p>
            </div>
            <Cancel className="text-gray-400" />
          </div>
        </Paper>
      </div>
      
      {/* Purchase Invoices Table */}
      <Paper className="p-4">
        <h2 className="text-lg font-semibold mb-4">All Purchase Invoices</h2>
        <DataGrid
          rows={purchases}
          columns={columns}
          loading={loading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50]}
          autoHeight
          disableRowSelectionOnClick
          sx={{
            "& .MuiDataGrid-cell": {
              fontSize: "0.875rem",
            },
            "& .MuiDataGrid-columnHeaderTitle": {
              fontWeight: 600,
            }
          }}
        />
      </Paper>
      
      {/* Quick Links */}
      <div className="mt-6 flex gap-4">
        <Link href="/vendors" className="text-blue-600 hover:underline">
          Manage Vendors →
        </Link>
        <Link href="/itc" className="text-blue-600 hover:underline">
          ITC Reconciliation Dashboard →
        </Link>
        <Link href="/returns" className="text-blue-600 hover:underline">
          GST Returns →
        </Link>
      </div>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  )
}