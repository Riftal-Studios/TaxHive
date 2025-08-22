/**
 * Accessibility utilities for GSTHive
 * Implements WCAG 2.1 AA compliance helpers
 */

/**
 * Generate unique IDs for ARIA relationships
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * ARIA live region announcements for screen readers
 */
export class AriaAnnouncer {
  private static instance: AriaAnnouncer
  private liveRegion: HTMLElement | null = null

  private constructor() {
    if (typeof window !== 'undefined') {
      this.createLiveRegion()
    }
  }

  static getInstance(): AriaAnnouncer {
    if (!AriaAnnouncer.instance) {
      AriaAnnouncer.instance = new AriaAnnouncer()
    }
    return AriaAnnouncer.instance
  }

  private createLiveRegion() {
    this.liveRegion = document.createElement('div')
    this.liveRegion.setAttribute('role', 'status')
    this.liveRegion.setAttribute('aria-live', 'polite')
    this.liveRegion.setAttribute('aria-atomic', 'true')
    this.liveRegion.style.position = 'absolute'
    this.liveRegion.style.left = '-10000px'
    this.liveRegion.style.width = '1px'
    this.liveRegion.style.height = '1px'
    this.liveRegion.style.overflow = 'hidden'
    document.body.appendChild(this.liveRegion)
  }

  announce(message: string, priority: 'polite' | 'assertive' = 'polite') {
    if (!this.liveRegion) return

    this.liveRegion.setAttribute('aria-live', priority)
    this.liveRegion.textContent = message

    // Clear after announcement
    setTimeout(() => {
      if (this.liveRegion) {
        this.liveRegion.textContent = ''
      }
    }, 1000)
  }
}

/**
 * Keyboard navigation utilities
 */
export const KeyboardNavigation = {
  /**
   * Handle arrow key navigation in lists/grids
   */
  handleArrowKeys(
    event: React.KeyboardEvent,
    currentIndex: number,
    totalItems: number,
    onNavigate: (index: number) => void,
    options: {
      orientation?: 'horizontal' | 'vertical' | 'grid'
      columns?: number
      loop?: boolean
    } = {}
  ) {
    const { orientation = 'vertical', columns = 1, loop = false } = options
    let newIndex = currentIndex

    switch (event.key) {
      case 'ArrowUp':
        if (orientation === 'vertical' || orientation === 'grid') {
          newIndex = orientation === 'grid' 
            ? currentIndex - columns 
            : currentIndex - 1
          if (newIndex < 0) {
            newIndex = loop ? totalItems - 1 : 0
          }
        }
        break

      case 'ArrowDown':
        if (orientation === 'vertical' || orientation === 'grid') {
          newIndex = orientation === 'grid' 
            ? currentIndex + columns 
            : currentIndex + 1
          if (newIndex >= totalItems) {
            newIndex = loop ? 0 : totalItems - 1
          }
        }
        break

      case 'ArrowLeft':
        if (orientation === 'horizontal' || orientation === 'grid') {
          newIndex = currentIndex - 1
          if (newIndex < 0) {
            newIndex = loop ? totalItems - 1 : 0
          }
        }
        break

      case 'ArrowRight':
        if (orientation === 'horizontal' || orientation === 'grid') {
          newIndex = currentIndex + 1
          if (newIndex >= totalItems) {
            newIndex = loop ? 0 : totalItems - 1
          }
        }
        break

      case 'Home':
        newIndex = 0
        break

      case 'End':
        newIndex = totalItems - 1
        break

      default:
        return
    }

    if (newIndex !== currentIndex) {
      event.preventDefault()
      onNavigate(newIndex)
    }
  },

  /**
   * Trap focus within a container (useful for modals)
   */
  trapFocus(container: HTMLElement) {
    const focusableElements = container.querySelectorAll(
      'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
    )
    const firstFocusable = focusableElements[0] as HTMLElement
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          event.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          event.preventDefault()
          firstFocusable?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    firstFocusable?.focus()

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  },
}

/**
 * ARIA attributes helper
 */
export const aria = {
  /**
   * Generate ARIA attributes for form fields
   */
  field(
    fieldId: string,
    options: {
      label?: string
      description?: string
      error?: string | boolean
      required?: boolean
    } = {}
  ) {
    const attrs: Record<string, string | boolean | undefined> = {
      id: fieldId,
      'aria-required': options.required,
      'aria-invalid': !!options.error,
    }

    if (options.label) {
      attrs['aria-label'] = options.label
    }

    if (options.description) {
      attrs['aria-describedby'] = `${fieldId}-description`
    }

    if (options.error && typeof options.error === 'string') {
      attrs['aria-describedby'] = attrs['aria-describedby'] 
        ? `${attrs['aria-describedby']} ${fieldId}-error`
        : `${fieldId}-error`
      attrs['aria-errormessage'] = options.error
    }

    return attrs
  },

  /**
   * Generate ARIA attributes for buttons
   */
  button(options: {
    label?: string
    pressed?: boolean
    expanded?: boolean
    controls?: string
    loading?: boolean
    disabled?: boolean
  } = {}) {
    const attrs: Record<string, string | boolean | undefined> = {}

    if (options.label) {
      attrs['aria-label'] = options.label
    }

    if (options.pressed !== undefined) {
      attrs['aria-pressed'] = options.pressed
    }

    if (options.expanded !== undefined) {
      attrs['aria-expanded'] = options.expanded
    }

    if (options.controls) {
      attrs['aria-controls'] = options.controls
    }

    if (options.loading) {
      attrs['aria-busy'] = true
      attrs['aria-label'] = `${options.label || 'Button'} (Loading...)`
    }

    if (options.disabled) {
      attrs['aria-disabled'] = true
    }

    return attrs
  },

  /**
   * Generate ARIA attributes for navigation
   */
  nav(options: {
    label: string
    current?: string
  }) {
    return {
      'aria-label': options.label,
      'aria-current': options.current || undefined,
    }
  },

  /**
   * Generate ARIA attributes for live regions
   */
  live(options: {
    polite?: boolean
    assertive?: boolean
    atomic?: boolean
    relevant?: 'additions' | 'removals' | 'text' | 'all'
  } = {}) {
    const attrs: Record<string, string | boolean> = {
      role: 'status',
    }

    if (options.assertive) {
      attrs['aria-live'] = 'assertive'
    } else {
      attrs['aria-live'] = 'polite'
    }

    if (options.atomic !== undefined) {
      attrs['aria-atomic'] = options.atomic
    }

    if (options.relevant) {
      attrs['aria-relevant'] = options.relevant
    }

    return attrs
  },
}

/**
 * Skip to main content link for keyboard navigation
 */
export function SkipToMainContent({ target = '#main-content' }: { target?: string }) {
  return `
    <a 
      href="${target}"
      style="
        position: absolute;
        left: -10000px;
        top: auto;
        width: 1px;
        height: 1px;
        overflow: hidden;
      "
      onFocus="this.style.left = '0'; this.style.width = 'auto'; this.style.height = 'auto';"
      onBlur="this.style.left = '-10000px'; this.style.width = '1px'; this.style.height = '1px';"
    >
      Skip to main content
    </a>
  `
}

/**
 * Focus management utilities
 */
export const FocusManager = {
  /**
   * Save and restore focus
   */
  saveFocus() {
    const activeElement = document.activeElement as HTMLElement
    return () => {
      activeElement?.focus()
    }
  },

  /**
   * Focus first invalid field in a form
   */
  focusFirstError(formElement: HTMLFormElement) {
    const firstInvalid = formElement.querySelector('[aria-invalid="true"]') as HTMLElement
    firstInvalid?.focus()
  },

  /**
   * Focus trap directive for React
   */
  useFocusTrap(ref: React.RefObject<HTMLElement>, enabled = true) {
    React.useEffect(() => {
      if (!enabled || !ref.current) return

      return KeyboardNavigation.trapFocus(ref.current)
    }, [ref, enabled])
  },
}

/**
 * Screen reader only text utility
 */
export function srOnly(text: string): React.CSSProperties {
  return {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
  }
}

/**
 * High contrast mode detection
 */
export function useHighContrastMode() {
  const [isHighContrast, setIsHighContrast] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-contrast: high)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches)
    }

    // Set initial value
    setIsHighContrast(mediaQuery.matches)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return isHighContrast
}

/**
 * Reduced motion detection
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    // Set initial value
    setPrefersReducedMotion(mediaQuery.matches)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  return prefersReducedMotion
}

// Import React for hooks
import React from 'react'