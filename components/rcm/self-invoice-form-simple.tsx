'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { api } from '@/lib/trpc/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { CalendarToday as CalendarIcon, Download, Description as FileText, Visibility as Eye } from '@mui/icons-material'
import { CircularProgress } from '@mui/material'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'

// Form validation schema
const selfInvoiceSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  serviceTypeId: z.string().min(1, 'Service type is required'),
  taxableAmount: z
    .number({ invalid_type_error: 'Taxable amount is required' })
    .positive('Taxable amount must be greater than 0'),
  cgstAmount: z.number().min(0).default(0),
  sgstAmount: z.number().min(0).default(0),
  igstAmount: z.number().min(0).default(0),
  supplyType: z.enum(['intra-state', 'inter-state']).default('intra-state'),
  invoiceDate: z.date().default(() => new Date()),
  paymentDate: z.date().optional(),
  description: z.string().optional(),
  supplierInvoiceNumber: z.string().optional(),
  supplierInvoiceDate: z.date().optional(),
})

type SelfInvoiceFormData = z.infer<typeof selfInvoiceSchema>

export function SelfInvoiceForm() {
  const router = useRouter()
  const utils = api.useUtils()
  const [showPreview, setShowPreview] = useState(false)

  // Form handling
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SelfInvoiceFormData>({
    resolver: zodResolver(selfInvoiceSchema),
    defaultValues: {
      supplyType: 'intra-state',
      invoiceDate: new Date(),
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      taxableAmount: 0,
    },
  })

  // Watch form values for auto-calculations
  const watchedValues = watch()
  const taxableAmount = watchedValues.taxableAmount || 0
  const supplyType = watchedValues.supplyType

  // API queries
  const { data: suppliers, isLoading: loadingSuppliers, error: suppliersError } = 
    api.rcm.getSuppliers.useQuery()
  
  const { data: serviceTypes, isLoading: loadingServiceTypes, error: serviceTypesError } = 
    api.rcm.getServiceTypes.useQuery()

  // API mutations
  const createTransaction = api.rcm.createTransaction.useMutation({
    onSuccess: () => {
      utils.rcm.getTransactions.invalidate()
    },
  })

  const generateSelfInvoice = api.rcm.generateSelfInvoice.useMutation({
    onSuccess: () => {
      toast.success('Self-invoice generated successfully')
      router.push('/rcm/self-invoice')
    },
    onError: (error) => {
      toast.error(`Failed to generate self-invoice: ${error.message}`)
    },
  })

  // Auto-calculate GST amounts based on supply type
  React.useEffect(() => {
    if (taxableAmount > 0) {
      if (supplyType === 'intra-state') {
        const cgst = Math.round(taxableAmount * 0.09) // 9% CGST
        const sgst = Math.round(taxableAmount * 0.09) // 9% SGST
        setValue('cgstAmount', cgst)
        setValue('sgstAmount', sgst)
        setValue('igstAmount', 0)
      } else {
        const igst = Math.round(taxableAmount * 0.18) // 18% IGST
        setValue('cgstAmount', 0)
        setValue('sgstAmount', 0)
        setValue('igstAmount', igst)
      }
    }
  }, [taxableAmount, supplyType, setValue])

  // Form submission
  const onSubmit = async (data: SelfInvoiceFormData) => {
    try {
      // First create the transaction
      const transaction = await createTransaction.mutateAsync({
        supplierId: data.supplierId,
        serviceTypeId: data.serviceTypeId,
        taxableAmount: data.taxableAmount,
        cgstAmount: data.cgstAmount,
        sgstAmount: data.sgstAmount,
        igstAmount: data.igstAmount,
        description: data.description || '',
        invoiceDate: data.invoiceDate,
        paymentDate: data.paymentDate,
        supplierInvoiceNumber: data.supplierInvoiceNumber,
        supplierInvoiceDate: data.supplierInvoiceDate,
      })

      // Then generate the self-invoice
      await generateSelfInvoice.mutateAsync({
        transactionId: transaction.id,
      })
    } catch (error) {
      // Error handling is done in mutation callbacks
      if (error instanceof Error) {
        toast.error(error.message)
      }
    }
  }

  // Get selected supplier and service details for preview
  const selectedSupplier = useMemo(() => {
    return suppliers?.find(s => s.id === watchedValues.supplierId)
  }, [suppliers, watchedValues.supplierId])

  const selectedService = useMemo(() => {
    return serviceTypes?.find(s => s.id === watchedValues.serviceTypeId)
  }, [serviceTypes, watchedValues.serviceTypeId])

  // Calculate total amount
  const totalAmount = taxableAmount + 
    (watchedValues.cgstAmount || 0) + 
    (watchedValues.sgstAmount || 0) + 
    (watchedValues.igstAmount || 0)

  // Preview handler
  const handlePreview = () => {
    if (!selectedSupplier || !selectedService) {
      toast.error('Please select supplier and service type')
      return
    }
    if (!taxableAmount || taxableAmount <= 0) {
      toast.error('Please enter a valid taxable amount')
      return
    }
    setShowPreview(true)
  }

  // Loading state
  if (loadingSuppliers || loadingServiceTypes) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <CircularProgress size={32} />
          <span className="ml-2">Loading suppliers and service types...</span>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (suppliersError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load suppliers: {suppliersError.message}</AlertDescription>
      </Alert>
    )
  }

  if (serviceTypesError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Failed to load service types: {serviceTypesError.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Generate Self-Invoice under RCM</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
              <Controller
                name="supplierId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="supplier">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers?.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name} ({supplier.gstin})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.supplierId && (
                <p className="text-sm text-red-500">{errors.supplierId.message}</p>
              )}
            </div>

            {/* Service Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="serviceType">Service Type *</Label>
              <Controller
                name="serviceTypeId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="serviceType">
                      <SelectValue placeholder="Select a service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes?.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name} (SAC: {service.sacCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.serviceTypeId && (
                <p className="text-sm text-red-500">{errors.serviceTypeId.message}</p>
              )}
            </div>

            {/* Supply Type */}
            <div className="space-y-2">
              <Label>Supply Type *</Label>
              <Controller
                name="supplyType"
                control={control}
                render={({ field }) => (
                  <RadioGroup value={field.value} onValueChange={field.onChange}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="intra-state" id="intra-state" />
                      <Label htmlFor="intra-state">Intra-state (CGST + SGST)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="inter-state" id="inter-state" />
                      <Label htmlFor="inter-state">Inter-state (IGST)</Label>
                    </div>
                  </RadioGroup>
                )}
              />
            </div>

            {/* Amount Fields */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="taxableAmount">Taxable Amount *</Label>
                <Input
                  id="taxableAmount"
                  type="number"
                  step="0.01"
                  {...register('taxableAmount', { valueAsNumber: true })}
                  placeholder="Enter taxable amount"
                />
                {errors.taxableAmount && (
                  <p className="text-sm text-red-500">{errors.taxableAmount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cgstAmount">CGST Amount</Label>
                <Input
                  id="cgstAmount"
                  type="number"
                  step="0.01"
                  {...register('cgstAmount', { valueAsNumber: true })}
                  readOnly
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sgstAmount">SGST Amount</Label>
                <Input
                  id="sgstAmount"
                  type="number"
                  step="0.01"
                  {...register('sgstAmount', { valueAsNumber: true })}
                  readOnly
                  className="bg-gray-50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="igstAmount">IGST Amount</Label>
                <Input
                  id="igstAmount"
                  type="number"
                  step="0.01"
                  {...register('igstAmount', { valueAsNumber: true })}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            </div>

            {/* Date Fields */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceDate">Invoice Date *</Label>
                <Controller
                  name="invoiceDate"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Controller
                  name="paymentDate"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Enter service description"
                rows={3}
              />
            </div>

            {/* Supplier Invoice Details (Optional) */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="supplierInvoiceNumber">Supplier Invoice Number</Label>
                <Input
                  id="supplierInvoiceNumber"
                  {...register('supplierInvoiceNumber')}
                  placeholder="Supplier's invoice number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierInvoiceDate">Supplier Invoice Date</Label>
                <Controller
                  name="supplierInvoiceDate"
                  control={control}
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
              </div>
            </div>

            {/* Total Amount Display */}
            <div className="rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span>₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreview}
                disabled={isSubmitting}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || createTransaction.isLoading || generateSelfInvoice.isLoading}
              >
                {isSubmitting || createTransaction.isLoading || generateSelfInvoice.isLoading ? (
                  <>
                    <CircularProgress size={16} className="mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Generate Self-Invoice
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Self-Invoice Preview</DialogTitle>
            <DialogDescription>
              Review the self-invoice details before generating
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSupplier && (
              <div>
                <h4 className="font-semibold">Supplier Details</h4>
                <p>{selectedSupplier.name}</p>
                <p className="text-sm text-gray-600">{selectedSupplier.gstin}</p>
                <p className="text-sm text-gray-600">
                  {selectedSupplier.address}, {selectedSupplier.city}, {selectedSupplier.state} - {selectedSupplier.pincode}
                </p>
              </div>
            )}
            {selectedService && (
              <div>
                <h4 className="font-semibold">Service Details</h4>
                <p>{selectedService.name}</p>
                <p className="text-sm text-gray-600">SAC Code: {selectedService.sacCode}</p>
              </div>
            )}
            <div>
              <h4 className="font-semibold">Amount Details</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Taxable Amount:</span>
                  <span>₹{taxableAmount.toLocaleString('en-IN')}</span>
                </div>
                {supplyType === 'intra-state' ? (
                  <>
                    <div className="flex justify-between">
                      <span>CGST (9%):</span>
                      <span>₹{(watchedValues.cgstAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SGST (9%):</span>
                      <span>₹{(watchedValues.sgstAmount || 0).toLocaleString('en-IN')}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between">
                    <span>IGST (18%):</span>
                    <span>₹{(watchedValues.igstAmount || 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total Amount:</span>
                  <span>₹{totalAmount.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
            {watchedValues.description && (
              <div>
                <h4 className="font-semibold">Description</h4>
                <p className="text-sm text-gray-600">{watchedValues.description}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}