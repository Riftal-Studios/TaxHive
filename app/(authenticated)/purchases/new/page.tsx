"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import { Button, Snackbar, Alert } from "@mui/material"
import { ArrowBack, Save, Add, Delete } from "@mui/icons-material"
import Link from "next/link"
import { ITC_CATEGORIES } from "@/lib/itc"

interface PurchaseLineItem {
  description: string
  hsnSacCode: string
  quantity: number
  rate: number
  amount: number
  gstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
}

export default function NewPurchaseInvoicePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [vendors, setVendors] = useState<any[]>([])
  const [selectedVendor, setSelectedVendor] = useState("")
  const [vendorDetails, setVendorDetails] = useState<any>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })
  
  // Form fields
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [placeOfSupply, setPlaceOfSupply] = useState("")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [documentUrl, setDocumentUrl] = useState("")
  
  // ITC fields
  const [itcEligible, setItcEligible] = useState(true)
  const [itcCategory, setItcCategory] = useState<keyof typeof ITC_CATEGORIES>("INPUTS")
  const [blockingCategory, setBlockingCategory] = useState<string>("")
  const [reversalReason, setReversalReason] = useState("")
  
  // Line items
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([{
    description: "",
    hsnSacCode: "",
    quantity: 1,
    rate: 0,
    amount: 0,
    gstRate: 18,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 0
  }])
  
  // Tax calculations
  const [taxableAmount, setTaxableAmount] = useState(0)
  const [cgstAmount, setCgstAmount] = useState(0)
  const [sgstAmount, setSgstAmount] = useState(0)
  const [igstAmount, setIgstAmount] = useState(0)
  const [cessAmount] = useState(0)
  const [totalGSTAmount, setTotalGSTAmount] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [itcClaimed, setItcClaimed] = useState(0)
  
  const createMutation = api.purchaseInvoices.create.useMutation({
    onSuccess: () => {
      setSnackbar({
        open: true,
        message: "Purchase invoice created successfully",
        severity: 'success'
      })
      router.push("/purchases")
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: `Failed to create invoice: ${error.message}`,
        severity: 'error'
      })
    }
  })
  
  
  // Recalculate totals when line items change
  useEffect(() => {
    calculateTotals()
  }, [lineItems, vendorDetails])
  
  // Calculate ITC when eligibility or amounts change
  useEffect(() => {
    calculateITC()
  }, [itcEligible, blockingCategory, totalGSTAmount])
  
  const { data: vendorsData } = api.purchaseInvoices.getVendors.useQuery()
  
  useEffect(() => {
    if (vendorsData) {
      setVendors(vendorsData)
    }
  }, [vendorsData])
  
  const handleVendorChange = (vendorId: string) => {
    setSelectedVendor(vendorId)
    const vendor = vendors.find(v => v.id === vendorId)
    if (vendor) {
      setVendorDetails(vendor)
      setPlaceOfSupply(vendor.stateCode)
    }
  }
  
  const addLineItem = () => {
    setLineItems([...lineItems, {
      description: "",
      hsnSacCode: "",
      quantity: 1,
      rate: 0,
      amount: 0,
      gstRate: 18,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0
    }])
  }
  
  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index))
    }
  }
  
  const updateLineItem = (index: number, field: keyof PurchaseLineItem, value: any) => {
    const updatedItems = [...lineItems]
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    }
    
    // Recalculate line item amounts
    const item = updatedItems[index]
    item.amount = item.quantity * item.rate
    
    // Calculate GST based on place of supply
    const gstAmount = (item.amount * item.gstRate) / 100
    
    // Get user's state code (assuming it's stored in session or settings)
    const userStateCode = "27" // Maharashtra - should be fetched from user profile
    
    if (placeOfSupply === userStateCode) {
      // Same state - CGST + SGST
      item.cgstAmount = gstAmount / 2
      item.sgstAmount = gstAmount / 2
      item.igstAmount = 0
    } else {
      // Different state - IGST
      item.cgstAmount = 0
      item.sgstAmount = 0
      item.igstAmount = gstAmount
    }
    
    setLineItems(updatedItems)
  }
  
  const calculateTotals = () => {
    let taxable = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    
    lineItems.forEach(item => {
      taxable += item.amount
      cgst += item.cgstAmount
      sgst += item.sgstAmount
      igst += item.igstAmount
    })
    
    setTaxableAmount(taxable)
    setCgstAmount(cgst)
    setSgstAmount(sgst)
    setIgstAmount(igst)
    
    const totalGST = cgst + sgst + igst + cessAmount
    setTotalGSTAmount(totalGST)
    setTotalAmount(taxable + totalGST)
  }
  
  const calculateITC = () => {
    if (!itcEligible || blockingCategory) {
      setItcClaimed(0)
      return
    }
    
    // For eligible ITC, claim the full GST amount
    setItcClaimed(totalGSTAmount)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedVendor || !invoiceNumber || !invoiceDate) {
      setSnackbar({
        open: true,
        message: "Please fill all required fields",
        severity: 'error'
      })
      return
    }
    
    if (lineItems.length === 0 || lineItems.some(item => !item.description || !item.hsnSacCode)) {
      setSnackbar({
        open: true,
        message: "Please add at least one line item with description and HSN/SAC code",
        severity: 'error'
      })
      return
    }
    
    setLoading(true)
    
    try {
      await createMutation.mutateAsync({
        vendorId: selectedVendor,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        placeOfSupply,
        taxableAmount,
        cgstRate: cgstAmount > 0 ? (cgstAmount / taxableAmount) * 100 : 0,
        sgstRate: sgstAmount > 0 ? (sgstAmount / taxableAmount) * 100 : 0,
        igstRate: igstAmount > 0 ? (igstAmount / taxableAmount) * 100 : 0,
        cgstAmount,
        sgstAmount,
        igstAmount,
        cessAmount,
        totalGSTAmount,
        totalAmount,
        itcEligible,
        itcCategory,
        itcClaimed,
        itcReversed: 0,
        reversalReason: reversalReason || undefined,
        description: description || undefined,
        notes: notes || undefined,
        documentUrl: documentUrl || undefined,
        lineItems: lineItems.map(item => ({
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
          gstRate: item.gstRate,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount
        }))
      })
    } catch (error) {
      console.error("Error creating purchase invoice:", error)
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/purchases" className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4">
          <ArrowBack className="mr-2" fontSize="small" />
          Back to Purchase Invoices
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create Purchase Invoice</h1>
        <p className="text-gray-600 mt-2">Record vendor invoices and track Input Tax Credit</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Vendor Selection */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Vendor Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Vendor *
              </label>
              <select
                value={selectedVendor}
                onChange={(e) => handleVendorChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map(vendor => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} {vendor.gstin ? `(${vendor.gstin})` : `(PAN: ${vendor.pan})`}
                  </option>
                ))}
              </select>
            </div>
            
            {vendorDetails && (
              <div className="text-sm text-gray-600">
                <p><strong>Address:</strong> {vendorDetails.address}</p>
                <p><strong>State Code:</strong> {vendorDetails.stateCode}</p>
                <p><strong>GST Registered:</strong> {vendorDetails.isRegistered ? "Yes" : "No"}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Invoice Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Number *
              </label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice Date *
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Place of Supply *
              </label>
              <input
                type="text"
                value={placeOfSupply}
                onChange={(e) => setPlaceOfSupply(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="State code (e.g., 27)"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of purchase"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document URL
              </label>
              <input
                type="url"
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Link to invoice PDF"
              />
            </div>
          </div>
        </div>
        
        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Line Items</h2>
            <Button
              type="button"
              onClick={addLineItem}
              variant="outlined"
              size="small"
              startIcon={<Add />}
            >
              Add Item
            </Button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">Description</th>
                  <th className="px-4 py-2 text-left">HSN/SAC</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2 text-right">GST %</th>
                  <th className="px-4 py-2 text-right">CGST</th>
                  <th className="px-4 py-2 text-right">SGST</th>
                  <th className="px-4 py-2 text-right">IGST</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        className="w-full px-2 py-1 border rounded"
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="text"
                        value={item.hsnSacCode}
                        onChange={(e) => updateLineItem(index, "hsnSacCode", e.target.value)}
                        className="w-24 px-2 py-1 border rounded"
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                        className="w-20 px-2 py-1 border rounded text-right"
                        min="0"
                        step="0.01"
                        required
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => updateLineItem(index, "rate", parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 border rounded text-right"
                        min="0"
                        step="0.01"
                        required
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      ₹{item.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={item.gstRate}
                        onChange={(e) => updateLineItem(index, "gstRate", parseFloat(e.target.value))}
                        className="w-20 px-2 py-1 border rounded"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right">
                      ₹{item.cgstAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      ₹{item.sgstAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      ₹{item.igstAmount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Delete fontSize="small" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* ITC Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Input Tax Credit (ITC) Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ITC Eligible?
              </label>
              <select
                value={itcEligible ? "yes" : "no"}
                onChange={(e) => setItcEligible(e.target.value === "yes")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ITC Category
              </label>
              <select
                value={itcCategory}
                onChange={(e) => setItcCategory(e.target.value as keyof typeof ITC_CATEGORIES)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!itcEligible}
              >
                <option value="INPUTS">Inputs</option>
                <option value="CAPITAL_GOODS">Capital Goods</option>
                <option value="INPUT_SERVICES">Input Services</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Blocked Category (if applicable)
              </label>
              <select
                value={blockingCategory}
                onChange={(e) => setBlockingCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- None --</option>
                <option value="MOTOR_VEHICLES">Motor Vehicles</option>
                <option value="HEALTH_INSURANCE">Health Insurance</option>
                <option value="LIFE_INSURANCE">Life Insurance</option>
                <option value="MEMBERSHIP_FEES">Membership Fees</option>
                <option value="PERSONAL_CONSUMPTION">Personal Consumption</option>
                <option value="WORKS_CONTRACT_IMMOVABLE">Works Contract (Immovable)</option>
                <option value="FOOD_BEVERAGES">Food & Beverages</option>
                <option value="OUTDOOR_CATERING">Outdoor Catering</option>
                <option value="BEAUTY_TREATMENT">Beauty Treatment</option>
                <option value="RENT_A_CAB">Rent-a-cab</option>
                <option value="TRAVEL_BENEFITS">Travel Benefits</option>
              </select>
            </div>
          </div>
          
          {blockingCategory && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reversal Reason
              </label>
              <input
                type="text"
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Reason for ITC reversal"
              />
            </div>
          )}
        </div>
        
        {/* Tax Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Tax Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Taxable Amount</p>
              <p className="text-lg font-semibold">₹{taxableAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">CGST</p>
              <p className="text-lg font-semibold">₹{cgstAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">SGST</p>
              <p className="text-lg font-semibold">₹{sgstAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">IGST</p>
              <p className="text-lg font-semibold">₹{igstAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">CESS</p>
              <p className="text-lg font-semibold">₹{cessAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">Total GST</p>
              <p className="text-lg font-semibold">₹{totalGSTAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">Total Amount</p>
              <p className="text-lg font-semibold">₹{totalAmount.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-600">ITC Eligible</p>
              <p className="text-lg font-semibold text-green-600">₹{itcClaimed.toFixed(2)}</p>
            </div>
          </div>
        </div>
        
        {/* Notes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Additional Notes</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Any additional notes or remarks"
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outlined"
            onClick={() => router.push("/purchases")}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={<Save />}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Purchase Invoice"}
          </Button>
        </div>
      </form>
      
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