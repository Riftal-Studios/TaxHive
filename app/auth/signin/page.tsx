'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
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
  Divider,
  Link as MuiLink,
} from '@mui/material'
import {
  Visibility,
  VisibilityOff,
  Email as EmailIcon,
  Lock as LockIcon,
  Mail as MailIcon,
} from '@mui/icons-material'
import { enqueueSnackbar } from 'notistack'

export default function SignInPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showMagicLink, setShowMagicLink] = useState(false)
  const [error, setError] = useState('')

  const handleCredentialsSignIn = async (e: React.FormEvent) => {
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
        router.push(callbackUrl)
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLinkSignIn = async () => {
    setLoading(true)
    setError('')
    
    try {
      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl,
      })
      
      if (result?.error) {
        setError(result.error)
      } else if (result?.ok) {
        router.push('/auth/verify-request')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            Sign in to GSTHive
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {!showMagicLink ? (
            <Box component="form" onSubmit={handleCredentialsSignIn} sx={{ mt: 2 }}>
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
                <Link href="/auth/forgot-password" passHref>
                  <MuiLink variant="body2">
                    Forgot password?
                  </MuiLink>
                </Link>
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
              
              <Divider sx={{ my: 2 }}>OR</Divider>
              
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setShowMagicLink(true)}
                disabled={loading}
                startIcon={<MailIcon />}
              >
                Sign in with Magic Link
              </Button>
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
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
              
              <Button
                fullWidth
                variant="contained"
                onClick={handleMagicLinkSignIn}
                disabled={loading || !email}
                sx={{ mb: 2 }}
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </Button>
              
              <Button
                fullWidth
                variant="text"
                onClick={() => setShowMagicLink(false)}
                disabled={loading}
              >
                Back to Password Sign In
              </Button>
            </Box>
          )}
          
          {loading && <LinearProgress sx={{ mt: 2 }} />}
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Don't have an account?{' '}
              <Link href="/auth/signup" style={{ color: 'inherit' }}>
                Sign up
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  )
}