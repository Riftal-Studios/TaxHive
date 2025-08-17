"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/trpc/client"
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Chip,
  Alert,
  FormControlLabel,
  Checkbox,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  InputAdornment,
  Snackbar,
  RadioGroup,
  Radio,
  FormLabel
} from "@mui/material"
import {
  Add,
  Delete,
  NavigateNext,
  NavigateBefore,
  Save,
  CalendarMonth,
  Email,
  CurrencyRupee,
  AttachMoney,
  Schedule,
  Description
} from "@mui/icons-material"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { format, addMonths } from "date-fns"

const steps = [
  "Template Details",
  "Schedule Configuration", 
  "Invoice Details",
  "Line Items",
  "Notifications",
  "Review & Create"
]

const frequencies = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "YEARLY", label: "Yearly" }
]

const daysOfWeek = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" }
]

const months = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
]

export default function NewRecurringInvoicePage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" })
  
  // Form state
  const [formData, setFormData] = useState({
    // Template Details
    templateName: "",
    clientId: "",
    
    // Schedule Configuration
    frequency: "MONTHLY" as "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY",
    interval: 1,
    dayOfWeek: null as number | null,
    dayOfMonth: null as number | null,
    monthOfYear: null as number | null,
    startDate: new Date(),
    endDate: null as Date | null,
    occurrences: null as number | null,
    endCondition: "never" as "never" | "date" | "occurrences",
    
    // Invoice Details
    invoiceType: "EXPORT" as "EXPORT" | "DOMESTIC_B2B" | "DOMESTIC_B2C",
    currency: "USD",
    paymentTerms: 30,
    serviceCode: "9983", // Default HSN for professional services
    placeOfSupply: "Outside India (Section 2-6)",
    lutId: "",
    
    // Line Items
    lineItems: [{
      description: "",
      hsnCode: "9983",
      quantity: 1,
      rate: 0,
      isVariable: false,
      minimumQuantity: null as number | null,
      maximumQuantity: null as number | null
    }],
    
    // Notifications
    sendAutomatically: false,
    ccEmails: [] as string[],
    emailTemplate: "",
    newCcEmail: ""
  })
  
  // Fetch data
  const { data: clients } = api.clients.list.useQuery()
  const { data: luts } = api.luts.list.useQuery({ activeOnly: true })
  
  // Create recurring invoice mutation
  const createRecurringInvoice = api.recurringInvoices.createRecurringInvoice.useMutation({
    onSuccess: (data) => {
      setSnackbar({
        open: true,
        message: "Recurring invoice template created successfully!",
        severity: "success"
      })
      setTimeout(() => {
        router.push("/recurring")
      }, 1500)
    },
    onError: (error) => {
      setSnackbar({
        open: true,
        message: error.message,
        severity: "error"
      })
      setLoading(false)
    }
  })
  
  const handleNext = () => {
    // Validate current step
    if (!validateStep(activeStep)) {
      return
    }
    setActiveStep((prevStep) => prevStep + 1)
  }
  
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1)
  }
  
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Template Details
        if (!formData.templateName || !formData.clientId) {
          setSnackbar({
            open: true,
            message: "Please fill in all required fields",
            severity: "error"
          })
          return false
        }
        break
      case 1: // Schedule Configuration
        if (formData.frequency === "WEEKLY" && formData.dayOfWeek === null) {
          setSnackbar({
            open: true,
            message: "Please select a day of the week",
            severity: "error"
          })
          return false
        }
        if (formData.frequency === "MONTHLY" && formData.dayOfMonth === null) {
          setSnackbar({
            open: true,
            message: "Please select a day of the month",
            severity: "error"
          })
          return false
        }
        break
      case 3: // Line Items
        if (formData.lineItems.length === 0) {
          setSnackbar({
            open: true,
            message: "Please add at least one line item",
            severity: "error"
          })
          return false
        }
        for (const item of formData.lineItems) {
          if (!item.description || item.rate <= 0) {
            setSnackbar({
              open: true,
              message: "Please fill in all line item details",
              severity: "error"
            })
            return false
          }
        }
        break
    }
    return true
  }
  
  const handleSubmit = async () => {
    if (!validateStep(activeStep)) {
      return
    }
    
    setLoading(true)
    
    // Prepare data for submission
    const submitData = {
      templateName: formData.templateName,
      clientId: formData.clientId,
      frequency: formData.frequency,
      interval: formData.interval,
      dayOfWeek: formData.dayOfWeek || undefined,
      dayOfMonth: formData.dayOfMonth || undefined,
      monthOfYear: formData.monthOfYear || undefined,
      startDate: formData.startDate,
      endDate: formData.endCondition === "date" ? formData.endDate : undefined,
      occurrences: formData.endCondition === "occurrences" ? formData.occurrences : undefined,
      invoiceType: formData.invoiceType,
      currency: formData.currency,
      paymentTerms: formData.paymentTerms,
      serviceCode: formData.serviceCode,
      placeOfSupply: formData.placeOfSupply,
      lutId: formData.lutId || undefined,
      sendAutomatically: formData.sendAutomatically,
      ccEmails: formData.ccEmails.length > 0 ? formData.ccEmails : undefined,
      emailTemplate: formData.emailTemplate || undefined,
      lineItems: formData.lineItems.map(item => ({
        description: item.description,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        rate: item.rate,
        isVariable: item.isVariable,
        minimumQuantity: item.isVariable && item.minimumQuantity !== null ? item.minimumQuantity : undefined,
        maximumQuantity: item.isVariable && item.maximumQuantity !== null ? item.maximumQuantity : undefined
      }))
    }
    
    createRecurringInvoice.mutate(submitData)
  }
  
  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        {
          description: "",
          hsnCode: "9983",
          quantity: 1,
          rate: 0,
          isVariable: false,
          minimumQuantity: null,
          maximumQuantity: null
        }
      ]
    }))
  }
  
  const removeLineItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index)
    }))
  }
  
  const updateLineItem = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      lineItems: prev.lineItems.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }
  
  const addCcEmail = () => {
    if (formData.newCcEmail && formData.newCcEmail.includes("@")) {
      setFormData(prev => ({
        ...prev,
        ccEmails: [...prev.ccEmails, prev.newCcEmail],
        newCcEmail: ""
      }))
    }
  }
  
  const removeCcEmail = (email: string) => {
    setFormData(prev => ({
      ...prev,
      ccEmails: prev.ccEmails.filter(e => e !== email)
    }))
  }
  
  const getStepContent = (step: number) => {
    switch (step) {
      case 0: // Template Details
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Template Name"
                value={formData.templateName}
                onChange={(e) => setFormData(prev => ({ ...prev, templateName: e.target.value }))}
                required
                helperText="A descriptive name for this recurring invoice template"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
                <InputLabel>Client</InputLabel>
                <Select
                  value={formData.clientId}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                  label="Client"
                >
                  {clients?.map((client: any) => (
                    <MenuItem key={client.id} value={client.id}>
                      {client.name} - {client.company}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        )
        
      case 1: // Schedule Configuration
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={formData.frequency}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    frequency: e.target.value as any,
                    dayOfWeek: null,
                    dayOfMonth: null,
                    monthOfYear: null
                  }))}
                  label="Frequency"
                >
                  {frequencies.map(freq => (
                    <MenuItem key={freq.value} value={freq.value}>
                      {freq.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Interval"
                value={formData.interval}
                onChange={(e) => setFormData(prev => ({ ...prev, interval: parseInt(e.target.value) || 1 }))}
                InputProps={{ inputProps: { min: 1 } }}
                helperText={`Every ${formData.interval} ${formData.frequency.toLowerCase()}`}
              />
            </Grid>
            
            {formData.frequency === "WEEKLY" && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Day of Week</InputLabel>
                  <Select
                    value={formData.dayOfWeek || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, dayOfWeek: e.target.value as number }))}
                    label="Day of Week"
                  >
                    {daysOfWeek.map(day => (
                      <MenuItem key={day.value} value={day.value}>
                        {day.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            {formData.frequency === "MONTHLY" && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Day of Month"
                  value={formData.dayOfMonth || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) || null }))}
                  InputProps={{ inputProps: { min: 1, max: 31 } }}
                  helperText="Enter 31 for last day of month"
                />
              </Grid>
            )}
            
            {formData.frequency === "YEARLY" && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Month of Year</InputLabel>
                  <Select
                    value={formData.monthOfYear || ""}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthOfYear: e.target.value as number }))}
                    label="Month of Year"
                  >
                    {months.map(month => (
                      <MenuItem key={month.value} value={month.value}>
                        {month.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            <Grid item xs={12} md={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(newValue) => setFormData(prev => ({ ...prev, startDate: newValue || new Date() }))}
                  sx={{ width: "100%" }}
                />
              </LocalizationProvider>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl component="fieldset">
                <FormLabel component="legend">End Condition</FormLabel>
                <RadioGroup
                  value={formData.endCondition}
                  onChange={(e) => setFormData(prev => ({ ...prev, endCondition: e.target.value as any }))}
                >
                  <FormControlLabel value="never" control={<Radio />} label="Never ends" />
                  <FormControlLabel value="date" control={<Radio />} label="End on specific date" />
                  <FormControlLabel value="occurrences" control={<Radio />} label="End after occurrences" />
                </RadioGroup>
              </FormControl>
            </Grid>
            
            {formData.endCondition === "date" && (
              <Grid item xs={12}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="End Date"
                    value={formData.endDate}
                    onChange={(newValue) => setFormData(prev => ({ ...prev, endDate: newValue }))}
                    sx={{ width: "100%" }}
                  />
                </LocalizationProvider>
              </Grid>
            )}
            
            {formData.endCondition === "occurrences" && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Number of Occurrences"
                  value={formData.occurrences || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, occurrences: parseInt(e.target.value) || null }))}
                  InputProps={{ inputProps: { min: 1 } }}
                />
              </Grid>
            )}
          </Grid>
        )
        
      case 2: // Invoice Details
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Invoice Type</InputLabel>
                <Select
                  value={formData.invoiceType}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceType: e.target.value as any }))}
                  label="Invoice Type"
                >
                  <MenuItem value="EXPORT">Export (Zero-rated)</MenuItem>
                  <MenuItem value="DOMESTIC_B2B">Domestic B2B</MenuItem>
                  <MenuItem value="DOMESTIC_B2C">Domestic B2C</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  label="Currency"
                >
                  <MenuItem value="USD">USD - US Dollar</MenuItem>
                  <MenuItem value="EUR">EUR - Euro</MenuItem>
                  <MenuItem value="GBP">GBP - British Pound</MenuItem>
                  <MenuItem value="INR">INR - Indian Rupee</MenuItem>
                  <MenuItem value="AUD">AUD - Australian Dollar</MenuItem>
                  <MenuItem value="CAD">CAD - Canadian Dollar</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                type="number"
                label="Payment Terms (Days)"
                value={formData.paymentTerms}
                onChange={(e) => setFormData(prev => ({ ...prev, paymentTerms: parseInt(e.target.value) || 30 }))}
                InputProps={{ inputProps: { min: 0 } }}
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Default HSN/SAC Code"
                value={formData.serviceCode}
                onChange={(e) => setFormData(prev => ({ ...prev, serviceCode: e.target.value }))}
                helperText="8-digit code for services"
              />
            </Grid>
            
            {formData.invoiceType === "EXPORT" && luts && luts.length > 0 && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>LUT (for exports)</InputLabel>
                  <Select
                    value={formData.lutId}
                    onChange={(e) => setFormData(prev => ({ ...prev, lutId: e.target.value }))}
                    label="LUT (for exports)"
                  >
                    <MenuItem value="">None</MenuItem>
                    {luts.map(lut => (
                      <MenuItem key={lut.id} value={lut.id}>
                        {lut.lutNumber} (Valid till {format(new Date(lut.validTill), "dd MMM yyyy")})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
          </Grid>
        )
        
      case 3: // Line Items
        return (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Line Items</Typography>
              <Button
                startIcon={<Add />}
                onClick={addLineItem}
                variant="outlined"
              >
                Add Item
              </Button>
            </Box>
            
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Description</TableCell>
                    <TableCell>HSN/SAC</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Rate</TableCell>
                    <TableCell align="center">Variable</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {formData.lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <TextField
                          fullWidth
                          size="small"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, "description", e.target.value)}
                          placeholder="Service description"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={item.hsnCode}
                          onChange={(e) => updateLineItem(index, "hsnCode", e.target.value)}
                          style={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                          style={{ width: 80 }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <TextField
                          size="small"
                          type="number"
                          value={item.rate}
                          onChange={(e) => updateLineItem(index, "rate", parseFloat(e.target.value) || 0)}
                          InputProps={{ inputProps: { min: 0, step: 0.01 } }}
                          style={{ width: 100 }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Checkbox
                          checked={item.isVariable}
                          onChange={(e) => updateLineItem(index, "isVariable", e.target.checked)}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {(item.quantity * item.rate).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => removeLineItem(index)}
                          disabled={formData.lineItems.length === 1}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {formData.lineItems.some(item => item.isVariable) && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Variable line items allow you to adjust quantities before each invoice generation based on actual usage.
              </Alert>
            )}
          </Box>
        )
        
      case 4: // Notifications
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.sendAutomatically}
                    onChange={(e) => setFormData(prev => ({ ...prev, sendAutomatically: e.target.checked }))}
                  />
                }
                label="Send invoices automatically to client"
              />
            </Grid>
            
            {formData.sendAutomatically && (
              <>
                <Grid item xs={12}>
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      CC Email Addresses
                    </Typography>
                    <Box display="flex" gap={1} mb={2}>
                      <TextField
                        size="small"
                        placeholder="email@example.com"
                        value={formData.newCcEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, newCcEmail: e.target.value }))}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addCcEmail()
                          }
                        }}
                      />
                      <Button onClick={addCcEmail} variant="outlined" size="small">
                        Add
                      </Button>
                    </Box>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {formData.ccEmails.map(email => (
                        <Chip
                          key={email}
                          label={email}
                          onDelete={() => removeCcEmail(email)}
                          size="small"
                        />
                      ))}
                    </Box>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Email Template (Optional)"
                    value={formData.emailTemplate}
                    onChange={(e) => setFormData(prev => ({ ...prev, emailTemplate: e.target.value }))}
                    helperText="Custom message to include in the email. Leave blank for default template."
                  />
                </Grid>
              </>
            )}
          </Grid>
        )
        
      case 5: // Review & Create
        const selectedClient = clients?.find(c => c.id === formData.clientId)
        const totalAmount = formData.lineItems.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
        
        return (
          <Box>
            <Alert severity="info" sx={{ mb: 3 }}>
              Please review the details below before creating the recurring invoice template.
            </Alert>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Template Information
                  </Typography>
                  <Typography variant="h6">{formData.templateName}</Typography>
                  <Typography>Client: {selectedClient?.name}</Typography>
                  <Typography>Type: {formData.invoiceType}</Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Schedule
                  </Typography>
                  <Typography>
                    {formData.frequency} (Every {formData.interval} {formData.frequency.toLowerCase()})
                  </Typography>
                  <Typography>Start: {format(formData.startDate, "dd MMM yyyy")}</Typography>
                  {formData.endCondition === "date" && formData.endDate && (
                    <Typography>End: {format(formData.endDate, "dd MMM yyyy")}</Typography>
                  )}
                  {formData.endCondition === "occurrences" && (
                    <Typography>Occurrences: {formData.occurrences}</Typography>
                  )}
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Invoice Details
                  </Typography>
                  <Typography>Currency: {formData.currency}</Typography>
                  <Typography>Payment Terms: Net {formData.paymentTerms} days</Typography>
                  <Typography>Amount: {formData.currency} {totalAmount.toFixed(2)}</Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Notifications
                  </Typography>
                  <Typography>
                    Auto-send: {formData.sendAutomatically ? "Yes" : "No"}
                  </Typography>
                  {formData.ccEmails.length > 0 && (
                    <Typography>CC: {formData.ccEmails.length} recipients</Typography>
                  )}
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    Line Items ({formData.lineItems.length})
                  </Typography>
                  {formData.lineItems.map((item, index) => (
                    <Box key={index} display="flex" justifyContent="space-between" mt={1}>
                      <Typography variant="body2">{item.description}</Typography>
                      <Typography variant="body2">
                        {item.quantity} × {formData.currency} {item.rate} = {formData.currency} {(item.quantity * item.rate).toFixed(2)}
                        {item.isVariable && " (Variable)"}
                      </Typography>
                    </Box>
                  ))}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )
        
      default:
        return null
    }
  }
  
  return (
    <Box sx={{ width: "100%", p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create Recurring Invoice Template
      </Typography>
      
      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <Paper sx={{ p: 3, minHeight: 400 }}>
        {getStepContent(activeStep)}
      </Paper>
      
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          startIcon={<NavigateBefore />}
        >
          Back
        </Button>
        
        <Box sx={{ display: "flex", gap: 2 }}>
          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading}
              startIcon={<Save />}
            >
              Create Template
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              endIcon={<NavigateNext />}
            >
              Next
            </Button>
          )}
        </Box>
      </Box>
      
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}