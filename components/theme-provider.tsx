'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { ThemeProvider as MUIThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { SnackbarProvider } from 'notistack'
import { theme as lightTheme, darkTheme } from '@/lib/theme'

interface ThemeContextType {
  isDarkMode: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultMode?: 'light' | 'dark' | 'system'
}

export function ThemeProvider({ children, defaultMode = 'system' }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Check for saved theme preference or use system preference
    const savedTheme = localStorage.getItem('theme-mode')
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark')
    } else if (defaultMode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDarkMode(prefersDark)
    } else {
      setIsDarkMode(defaultMode === 'dark')
    }
  }, [defaultMode])

  useEffect(() => {
    // Listen for system theme changes
    if (defaultMode === 'system' && !localStorage.getItem('theme-mode')) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = (e: MediaQueryListEvent) => {
        setIsDarkMode(e.matches)
      }
      
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [defaultMode])

  const toggleTheme = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('theme-mode', newMode ? 'dark' : 'light')
  }

  // Prevent SSR mismatch
  if (!mounted) {
    return null
  }

  const activeTheme = isDarkMode ? darkTheme : lightTheme

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      <MUIThemeProvider theme={activeTheme}>
        <CssBaseline />
        <SnackbarProvider 
          maxSnack={3}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          autoHideDuration={5000}
        >
          {children}
        </SnackbarProvider>
      </MUIThemeProvider>
    </ThemeContext.Provider>
  )
}