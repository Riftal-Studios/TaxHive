'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/trpc/client'
import { validatePassword } from '@/lib/auth/password'
import { PasswordStrengthIcon } from '@/components/password-strength-meter'
import {
  Box,
  Container,
  TextField,
  Button,
  Typography,
  Paper,
  Alert,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  Theme,
} from '@mui/material'
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Person as PersonIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'

export default function SignUpPage() {
  const router = useRouter()
  const [activeStep, setActiveStep] = useState(0)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [otpError, setOtpError] = useState('')

  const sendOTPMutation = api.auth.sendSignupOTP.useMutation({
    onSuccess: () => {
      setOtpSent(true)
      // Don't move to next step automatically - wait for OTP verification
      enqueueSnackbar('Verification code sent to your email!', { variant: 'success' })
    },
    onError: (error) => {
      setEmailError(error.message)
    },
  })

  const signupMutation = api.auth.signupWithOTP.useMutation({
    onSuccess: () => {
      enqueueSnackbar('Account created successfully! Please sign in.', { variant: 'success' })
      router.push('/auth/signin')
    },
    onError: (error) => {
      if (error.message.includes('OTP')) {
        setOtpError(error.message)
      } else if (error.message.includes('Password')) {
        setPasswordError(error.message)
      } else {
        enqueueSnackbar(error.message, { variant: 'error' })
      }
    },
  })

  const handleSendOTP = async () => {
    setEmailError('')
    
    // Validate email
    if (!email) {
      setEmailError('Email is required')
      return
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setEmailError('Please enter a valid email address')
      return
    }

    await sendOTPMutation.mutateAsync({ email })
  }

  const handleSignup = async () => {
    setPasswordError('')
    setOtpError('')
    
    // Validate name
    if (!name.trim()) {
      enqueueSnackbar('Name is required', { variant: 'error' })
      return
    }
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    
    // Validate password strength
    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.errors[0])
      return
    }
    
    // Validate OTP
    if (otp.length !== 6) {
      setOtpError('Please enter the 6-digit code')
      return
    }

    await signupMutation.mutateAsync({
      email,
      otp,
      password,
      name: name.trim(),
    })
  }

  const steps = ['Verify Email', 'Create Password']

  const isLoading = sendOTPMutation.isPending || signupMutation.isPending

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
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            Create your GSTHive account
          </Typography>
          
          <Stepper activeStep={activeStep} sx={{ mt: 3, mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSendOTP(); }}>
              <TextField
                fullWidth
                label="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={!!emailError}
                helperText={emailError}
                disabled={otpSent}
                autoComplete="email"
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 2 }}
              />
              
              {otpSent && (
                <>
                  <Alert severity="info" sx={{ mb: 2 }}>
                    A 6-digit verification code has been sent to {email}
                  </Alert>
                  
                  <TextField
                    fullWidth
                    label="Verification Code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    error={!!otpError}
                    helperText={otpError || 'Enter the 6-digit code sent to your email'}
                    inputProps={{ maxLength: 6, pattern: '[0-9]*' }}
                    sx={{ mb: 2 }}
                  />
                  
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => {
                      if (otp.length === 6) {
                        setActiveStep(1)
                      } else {
                        setOtpError('Please enter the 6-digit code')
                      }
                    }}
                    disabled={otp.length !== 6 || isLoading}
                    sx={{ mb: 2 }}
                  >
                    Verify & Continue
                  </Button>
                  
                  <Button
                    fullWidth
                    variant="text"
                    onClick={handleSendOTP}
                    disabled={isLoading}
                  >
                    Resend Code
                  </Button>
                </>
              )}
              
              {!otpSent && (
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  disabled={isLoading}
                  sx={{ mb: 2 }}
                >
                  Send Verification Code
                </Button>
              )}
            </Box>
          )}

          {activeStep === 1 && (
            <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
              <TextField
                fullWidth
                label="Email (Verified)"
                value={email}
                disabled
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="success" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ 
                  mb: 3,
                  '& .MuiInputBase-input.Mui-disabled': {
                    WebkitTextFillColor: (theme) => theme.palette.text.secondary,
                    color: (theme) => theme.palette.text.secondary,
                  }
                }}
              />
              
              <TextField
                fullWidth
                label="Full Name (As per PAN)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon />
                    </InputAdornment>
                  ),
                }}
                sx={{ mb: 3 }}
              />
              
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!passwordError}
                helperText={passwordError}
                autoComplete="new-password"
                inputProps={{
                  sx: {
                    '&:-webkit-autofill': {
                      WebkitBoxShadow: (theme: Theme) => 
                        theme.palette.mode === 'dark' 
                          ? '0 0 0 100px #1e1e1e inset !important'
                          : '0 0 0 100px #fff inset !important',
                      WebkitTextFillColor: (theme: Theme) => 
                        theme.palette.mode === 'dark' 
                          ? '#fff !important' 
                          : '#000 !important',
                    },
                    '&:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
                      WebkitBoxShadow: (theme: Theme) => 
                        theme.palette.mode === 'dark' 
                          ? '0 0 0 100px #1e1e1e inset !important'
                          : '0 0 0 100px #fff inset !important',
                      WebkitTextFillColor: (theme: Theme) => 
                        theme.palette.mode === 'dark' 
                          ? '#fff !important' 
                          : '#000 !important',
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PasswordStrengthIcon password={password} />
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
                sx={{ mb: 3 }}
              />
              
              <TextField
                fullWidth
                label="Confirm Password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={!!passwordError && password !== confirmPassword}
                helperText={password !== confirmPassword ? 'Passwords do not match' : ''}
                autoComplete="new-password"
                inputProps={{
                  sx: {
                    '&:-webkit-autofill': {
                      WebkitBoxShadow: (theme: Theme) => 
                        theme.palette.mode === 'dark' 
                          ? '0 0 0 100px #1e1e1e inset !important'
                          : '0 0 0 100px #fff inset !important',
                      WebkitTextFillColor: (theme: Theme) => 
                        theme.palette.mode === 'dark' 
                          ? '#fff !important' 
                          : '#000 !important',
                    },
                    '&:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
                      WebkitBoxShadow: (theme: Theme) => 
                        theme.palette.mode === 'dark' 
                          ? '0 0 0 100px #1e1e1e inset !important'
                          : '0 0 0 100px #fff inset !important',
                      WebkitTextFillColor: (theme: Theme) => 
                        theme.palette.mode === 'dark' 
                          ? '#fff !important' 
                          : '#000 !important',
                    },
                  },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PasswordStrengthIcon 
                        password={password} 
                        confirmPassword={confirmPassword} 
                        isConfirmField 
                      />
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
                disabled={isLoading || !name.trim() || !password || password !== confirmPassword}
                sx={{ mb: 2 }}
              >
                Create Account
              </Button>
              
              <Button
                fullWidth
                variant="text"
                onClick={() => setActiveStep(0)}
                disabled={isLoading}
              >
                Back to Email Verification
              </Button>
            </Box>
          )}

          {isLoading && <LinearProgress sx={{ mt: 2 }} />}
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <Link href="/auth/signin" style={{ color: 'inherit' }}>
                Sign in
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}