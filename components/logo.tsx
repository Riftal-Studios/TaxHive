'use client'

import Image from 'next/image'
import { useTheme } from '@/components/theme-provider'
import { useState, useEffect } from 'react'

interface LogoProps {
  width?: number
  height?: number
  className?: string
}

export function Logo({ width = 48, height = 48, className = '' }: LogoProps) {
  const { isDarkMode } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Default to light logo during SSR to prevent hydration mismatch
  const logoSrc = mounted ? (isDarkMode ? '/logo-dark.svg' : '/logo-light.svg') : '/logo-light.svg'

  return (
    <Image
      src={logoSrc}
      alt="TaxHive Logo"
      width={width}
      height={height}
      className={className}
      priority
      suppressHydrationWarning
    />
  )
}
