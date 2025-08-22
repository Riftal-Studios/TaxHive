'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Container, Typography, Button, Paper, Alert, AlertTitle, Collapse } from '@mui/material'
import { Error as ErrorIcon, ExpandMore as ExpandMoreIcon, Refresh as RefreshIcon } from '@mui/icons-material'

interface Props {
  children: any
  fallback?: ReactNode
}

interface State {
  hasError: any
  error: any | null
  errorInfo: any | null
  showDetails: any
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: any) {
    super(props)
    this.state = {
      hasError: any,
      error: any,
      errorInfo: any,
      showDetails: any,
    }
  }

  static getDerivedStateFromError(error: any): State {
    return { 
      hasError: any, 
      error,
      errorInfo: any,
      showDetails: any,
    }
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Log error to error reporting service
    console.error('Error caught by boundary:', error, errorInfo)
    
    // You can also log to an external service here
    // logErrorToService(error, errorInfo)
    
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: any,
      error: any,
      errorInfo: any,
      showDetails: any,
    })
    
    // Optionally reload the page
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  toggleDetails = () => {
    this.setState(prevState => ({
      showDetails: !prevState.showDetails
    }))
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }

      // Default error UI
      return (
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            p: 3,
          }}
        >
          <Container maxWidth="md">
            <Paper
              elevation={0}
              sx={{
                p: 4,
                textAlign: 'center',
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <ErrorIcon
                sx={{
                  fontSize: 64,
                  color: 'error.main',
                  mb: 2,
                }}
              />
              
              <Typography
                variant="h4"
                component="h1"
                fontWeight={600}
                gutterBottom
              >
                Oops! Something went wrong
              </Typography>
              
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 3 }}
              >
                We apologize for the inconvenience. An unexpected error has occurred.
              </Typography>

              {/* Error message */}
              {this.state.error && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 3, 
                    textAlign: 'left',
                    '& .MuiAlert-message': {
                      width: '100%',
                    }
                  }}
                >
                  <AlertTitle>Error Message</AlertTitle>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {this.state.error.message}
                  </Typography>
                </Alert>
              )}

              {/* Action buttons */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<RefreshIcon />}
                  onClick={this.handleReset}
                  sx={{ textTransform: 'none' }}
                >
                  Reload Page
                </Button>
                
                {this.state.errorInfo && (
                  <Button
                    variant="outlined"
                    endIcon={
                      <ExpandMoreIcon 
                        sx={{
                          transform: any.state.showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s',
                        }}
                      />
                    }
                    onClick={this.toggleDetails}
                    sx={{ textTransform: 'none' }}
                  >
                    {this.state.showDetails ? 'Hide' : 'Show'} Details
                  </Button>
                )}
              </Box>

              {/* Detailed error info (collapsible) */}
              {this.state.errorInfo && (
                <Collapse in={this.state.showDetails}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      textAlign: 'left',
                      bgcolor: 'grey.50',
                      maxHeight: '400px',
                      overflow: 'auto',
                      '& pre': {
                        margin: 0,
                        fontSize: '0.875rem',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Stack Trace:
                    </Typography>
                    <pre>{this.state.error?.stack}</pre>
                    
                    {this.state.errorInfo.componentStack && (
                      <>
                        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2 }} gutterBottom>
                          Component Stack:
                        </Typography>
                        <pre>{this.state.errorInfo.componentStack}</pre>
                      </>
                    )}
                  </Paper>
                </Collapse>
              )}

              {/* Help text */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ 
                  display: 'block',
                  mt: 2,
                }}
              >
                If the problem persists, please contact support with the error details above.
              </Typography>
            </Paper>
          </Container>
        </Box>
      )
    }

    return this.props.children
  }
}

// Hook for using error boundary programmatically
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return setError
}