'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
  Link as MuiLink,
} from '@mui/material'
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
} from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'

export default function SignInPage() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      })
      
      if (result?.error) {
        setError(result.error)
      } else if (result?.ok) {
        enqueueSnackbar('Signed in successfully!', { variant: 'success' })
        // Use window.location for dynamic callback URL to avoid typed routes issue
        window.location.href = callbackUrl
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

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
            Sign in to TaxHive
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box component="form" onSubmit={handleSignIn} sx={{ mt: 2 }}>
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
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
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
              sx={{ mb: 1 }}
            />
            
            <Box sx={{ textAlign: 'right', mb: 2 }}>
              <MuiLink href="/auth/forgot-password" variant="body2" component={Link}>
                Forgot password?
              </MuiLink>
            </Box>
            
            <Button
              fullWidth
              type="submit"
              variant="contained"
              disabled={loading}
              sx={{ mb: 2 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>
          
          {loading && <LinearProgress sx={{ mt: 2 }} />}
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Don&apos;t have an account?{' '}
              <MuiLink href="/auth/signup" component={Link} color="inherit">
                Sign up
              </MuiLink>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}