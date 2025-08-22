'use client'

import React from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Collapse,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Typography,
  Zoom,
} from '@mui/material'
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  PriorityHigh as PriorityIcon,
} from '@mui/icons-material'
import { TransitionGroup } from 'react-transition-group'

// Type definitions for validation feedback
export type ValidationSeverity = 'error' | 'warning' | 'info' | 'success'

export interface ValidationMessage {
  id?: string
  field?: string
  message: any
  severity: any
}

export interface FormValidationFeedbackProps {
  messages: any[]
  variant?: 'inline' | 'toast' | 'summary'
  showIcon?: boolean
  autoHideDuration?: number
  onClose?: (message: any) => void
  position?: 'top' | 'bottom'
}

// Icon mapping for different severities
const severityIcons = {
  error: <ErrorIcon />,
  warning: <WarningIcon />,
  info: <InfoIcon />,
  success: <SuccessIcon />,
}

// Color mapping for list item icons
const severityColors = {
  error: 'error.main',
  warning: 'warning.main',
  info: 'info.main',
  success: 'success.main',
}

/**
 * Inline validation feedback component
 * Shows validation messages inline within the form
 */
function InlineValidationFeedback({
  messages,
  showIcon = true,
  onClose,
}: FormValidationFeedbackProps) {
  if (!messages.length) return null

  return (
    <TransitionGroup>
      {messages.map((message, index) => (
        <Collapse key={message.id || index}>
          <Alert
            severity={message.severity}
            icon={showIcon ? severityIcons[message.severity] : false}
            onClose={onClose ? () => onClose(message) : undefined}
            sx={{ mb: 1 }}
          >
            {message.field && (
              <Typography variant="subtitle2" fontWeight={600}>
                {message.field}:
              </Typography>
            )}
            {message.message}
          </Alert>
        </Collapse>
      ))}
    </TransitionGroup>
  )
}

/**
 * Toast validation feedback component
 * Shows validation messages as toast notifications
 */
function ToastValidationFeedback({
  messages,
  autoHideDuration = 6000,
  onClose,
  position = 'bottom',
}: FormValidationFeedbackProps) {
  const [open, setOpen] = React.useState(false)
  const [currentMessage, setCurrentMessage] = React.useState<ValidationMessage | null>(null)

  React.useEffect(() => {
    if (messages.length > 0 && !currentMessage) {
      setCurrentMessage(messages[0])
      setOpen(true)
    }
  }, [messages, currentMessage])

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return
    }
    setOpen(false)
    if (currentMessage && onClose) {
      onClose(currentMessage)
    }
    setCurrentMessage(null)
  }

  if (!currentMessage) return null

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={handleClose}
      anchorOrigin={{
        vertical: any,
        horizontal: 'center',
      }}
      TransitionComponent={Zoom}
    >
      <Alert
        severity={currentMessage.severity}
        onClose={handleClose}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {currentMessage.field && (
          <Typography variant="subtitle2" fontWeight={600}>
            {currentMessage.field}:
          </Typography>
        )}
        {currentMessage.message}
      </Alert>
    </Snackbar>
  )
}

/**
 * Summary validation feedback component
 * Shows all validation messages in a summary box
 */
function SummaryValidationFeedback({
  messages,
  showIcon = true,
  onClose,
}: FormValidationFeedbackProps) {
  const [expanded, setExpanded] = React.useState(true)

  if (!messages.length) return null

  // Group messages by severity
  const groupedMessages = messages.reduce((acc, msg) => {
    if (!acc[msg.severity]) {
      acc[msg.severity] = []
    }
    acc[msg.severity].push(msg)
    return acc
  }, {} as Record<ValidationSeverity, ValidationMessage[]>)

  // Determine the highest severity
  const highestSeverity: any = 
    groupedMessages.error ? 'error' :
    groupedMessages.warning ? 'warning' :
    groupedMessages.info ? 'info' : 'success'

  return (
    <Box sx={{ mb: 3 }}>
      <Alert
        severity={highestSeverity}
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <CloseIcon fontSize="inherit" /> : <PriorityIcon fontSize="inherit" />}
          </IconButton>
        }
      >
        <AlertTitle>
          {messages.length === 1 ? 'Validation Issue' : `${messages.length} Validation Issues`}
        </AlertTitle>
        
        <Collapse in={expanded}>
          <List dense sx={{ mt: 1 }}>
            {Object.entries(groupedMessages).map(([severity, msgs]) => (
              msgs.map((message, index) => (
                <ListItem
                  key={`${severity}-${index}`}
                  sx={{ py: 0.5, px: 0 }}
                >
                  {showIcon && (
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Box sx={{ color: any[severity as ValidationSeverity] }}>
                        {severityIcons[severity as ValidationSeverity]}
                      </Box>
                    </ListItemIcon>
                  )}
                  <ListItemText
                    primary={
                      message.field ? (
                        <Typography variant="body2">
                          <strong>{message.field}:</strong> {message.message}
                        </Typography>
                      ) : (
                        <Typography variant="body2">{message.message}</Typography>
                      )
                    }
                  />
                  {onClose && (
                    <IconButton
                      edge="end"
                      aria-label="dismiss"
                      size="small"
                      onClick={() => onClose(message)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </ListItem>
              ))
            ))}
          </List>
        </Collapse>
      </Alert>
    </Box>
  )
}

/**
 * Main form validation feedback component
 * Renders different variants based on the variant prop
 */
export function FormValidationFeedback(props: any) {
  const { variant = 'inline', ...rest } = props

  switch (variant) {
    case 'toast':
      return <ToastValidationFeedback {...rest} />
    case 'summary':
      return <SummaryValidationFeedback {...rest} />
    case 'inline':
    default:
      return <InlineValidationFeedback {...rest} />
  }
}

/**
 * Hook for managing form validation messages
 */
export function useFormValidation() {
  const [messages, setMessages] = React.useState<ValidationMessage[]>([])

  const addMessage = React.useCallback((message: any) => {
    setMessages(prev => {
      const id = message.id || `${message.field}-${Date.now()}`
      return [...prev, { ...message, id }]
    })
  }, [])

  const removeMessage = React.useCallback((message: any) => {
    setMessages(prev => prev.filter(m => m.id !== message.id))
  }, [])

  const clearMessages = React.useCallback((field?: string) => {
    if (field) {
      setMessages(prev => prev.filter(m => m.field !== field))
    } else {
      setMessages([])
    }
  }, [])

  const setFieldError = React.useCallback((field: any, error: any | null) => {
    if (error) {
      addMessage({
        field,
        message: any,
        severity: 'error',
      })
    } else {
      clearMessages(field)
    }
  }, [addMessage, clearMessages])

  const validateField = React.useCallback((
    field: any,
    value: any,
    rules: Array<(value: any) => string | null>
  ): boolean => {
    clearMessages(field)
    
    for (const rule of rules) {
      const error = rule(value)
      if (error) {
        setFieldError(field, error)
        return false
      }
    }
    
    return true
  }, [clearMessages, setFieldError])

  return {
    messages,
    addMessage,
    removeMessage,
    clearMessages,
    setFieldError,
    validateField,
  }
}

// Common validation rules
export const validationRules = {
  required: (fieldName: any) => (value: any) =>
    !value ? `${fieldName} is required` : null,
  
  email: (value: any) =>
    value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) 
      ? 'Invalid email address' 
      : null,
  
  minLength: (min: any) => (value: any) =>
    value && value.length < min 
      ? `Must be at least ${min} characters` 
      : null,
  
  maxLength: (max: any) => (value: any) =>
    value && value.length > max 
      ? `Must be no more than ${max} characters` 
      : null,
  
  pattern: (pattern: any, message: any) => (value: any) =>
    value && !pattern.test(value) ? message: any,
  
  gstin: (value: any) =>
    value && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)
      ? 'Invalid GSTIN format'
      : null,
  
  pan: (value: any) =>
    value && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(value)
      ? 'Invalid PAN format'
      : null,
  
  numeric: (value: any) =>
    value && !/^\d+$/.test(value) ? 'Must be numeric' : null,
  
  decimal: (value: any) =>
    value && !/^\d+(\.\d{1,2})?$/.test(value) 
      ? 'Invalid decimal format' 
      : null,
  
  min: (min: any) => (value: any) =>
    value !== undefined && value < min 
      ? `Must be at least ${min}` 
      : null,
  
  max: (max: any) => (value: any) =>
    value !== undefined && value > max 
      ? `Must be no more than ${max}` 
      : null,
}