'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/trpc/client'
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  InputAdornment,
  LinearProgress,
  IconButton,
} from '@mui/material'
import {
  Email as EmailIcon,
  Lock as LockIcon,
  ArrowBack as ArrowBackIcon,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'reset'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')

  const sendOTPMutation = api.auth.sendPasswordResetOTP.useMutation({
    onSuccess: () => {
      setStep('reset')
      enqueueSnackbar('If an account exists, a verification code has been sent', { variant: 'info' })
    },
    onError: (error) => {
      setError(error.message)
    },
  })

  const resetPasswordMutation = api.auth.resetPasswordWithOTP.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Password reset successfully! Please sign in.', { variant: 'success' })
      router.push('/auth/signin')
    },
    onError: (error) => {
      setError(error.message)
    },
  })

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    await sendOTPMutation.mutateAsync({ email })
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    await resetPasswordMutation.mutateAsync({
      email,
      otp,
      newPassword,
    })
  }

  const isLoading = sendOTPMutation.isPending || resetPasswordMutation.isPending

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={() => router.push('/auth/signin')} sx={{ mr: 1 }}>
              <ArrowBackIcon />
            </IconButton>
            <Typography component="h1" variant="h5">
              Reset Password
            </Typography>
          </Box>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {step === 'email' ? (
            <Box component="form" onSubmit={handleSendOTP}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Enter your email address and we&apos;ll send you a verification code to reset your password.
              </Typography>
              
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />
              
              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={isLoading || !email}
                sx={{ mb: 2 }}
              >
                {isLoading ? 'Sending...' : 'Send Verification Code'}
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleResetPassword}>
              <Alert severity="info" sx={{ mb: 3 }}>
                A verification code has been sent to {email}
              </Alert>
              
              <TextField
                fullWidth
                label="Verification Code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
                helperText="Enter the 6-digit code sent to your email"
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                helperText="At least 8 characters with uppercase, lowercase, number, and special character"
                sx={{ mb: 2 }}
              />
              
              <TextField
                fullWidth
                label="Confirm New Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                error={!!confirmPassword && newPassword !== confirmPassword}
                helperText={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : ''}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />
              
              <Button
                fullWidth
                type="submit"
                variant="contained"
                disabled={isLoading || !otp || !newPassword || newPassword !== confirmPassword}
                sx={{ mb: 2 }}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Button>
              
              <Button
                fullWidth
                variant="text"
                onClick={() => sendOTPMutation.mutate({ email })}
                disabled={isLoading}
              >
                Resend Code
              </Button>
            </Box>
          )}
          
          {isLoading && <LinearProgress sx={{ mt: 2 }} />}
        </Paper>
      </Box>
    </Container>
  )
}