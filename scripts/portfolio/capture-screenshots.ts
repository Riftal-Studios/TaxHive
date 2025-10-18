import { chromium, Browser, Page } from '@playwright/test'
import path from 'path'

const DEMO_EMAIL = 'demo@taxhive.app'
const DEMO_PASSWORD = 'Demo123!'
const BASE_URL = 'http://localhost:3000'
const SCREENSHOT_DIR = path.join(process.cwd(), 'portfolio', 'screenshots')

interface Screenshot {
  name: string
  url: string
  description: string
  waitFor?: string | number
  actions?: (page: Page) => Promise<void>
}

const screenshots: Screenshot[] = [
  {
    name: '01-dashboard',
    url: '/dashboard',
    description: 'Dashboard with real-time metrics, revenue charts, and invoice status overview',
    waitFor: 3000, // Wait for charts to render
  },
  {
    name: '02-invoices-list',
    url: '/invoices',
    description: 'Invoice management with multi-currency support, filtering, and status tracking',
    waitFor: 2000,
  },
  {
    name: '03-invoice-detail',
    url: '/invoices',
    description: 'Invoice detail view showing line items, GST compliance fields, and payment tracking',
    waitFor: 2000,
    actions: async (page: Page) => {
      // Click on the first invoice to view details
      const firstInvoiceRow = page.locator('table tbody tr').first()
      if (await firstInvoiceRow.isVisible()) {
        await firstInvoiceRow.click()
        await page.waitForTimeout(2000) // Wait for navigation and load
      }
    },
  },
  {
    name: '04-clients-list',
    url: '/clients',
    description: 'Client management with international customers across multiple currencies',
    waitFor: 2000,
  },
  {
    name: '05-payments',
    url: '/payments',
    description: 'Payment tracking with FIRC documentation, exchange rates, and bank charges',
    waitFor: 2000,
  },
  {
    name: '06-lut-management',
    url: '/luts',
    description: 'Letter of Undertaking (LUT) management for GST-compliant export invoicing',
    waitFor: 2000,
  },
]

async function login(page: Page) {
  console.log('  🔑 Logging in with demo credentials...')
  
  await page.goto(`${BASE_URL}/auth/signin`)
  await page.waitForLoadState('networkidle')
  
  // Fill in credentials
  await page.fill('input[type="email"]', DEMO_EMAIL)
  await page.fill('input[type="password"]', DEMO_PASSWORD)
  
  // Click sign in button
  await page.click('button[type="submit"]')
  
  // Wait for redirect to dashboard or onboarding completion
  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 })
  
  // If we're on onboarding, wait for completion (should not happen with demo user)
  if (page.url().includes('/onboarding')) {
    await page.waitForURL('/dashboard', { timeout: 5000 }).catch(() => {
      console.warn('  ⚠️  Still on onboarding page, continuing anyway...')
    })
  }
  
  console.log('  ✅ Logged in successfully')
}

async function captureScreenshot(
  page: Page,
  screenshot: Screenshot,
  index: number
) {
  console.log(`  📸 Capturing: ${screenshot.name}`)
  console.log(`     ${screenshot.description}`)
  
  // Navigate to the URL
  await page.goto(`${BASE_URL}${screenshot.url}`)
  await page.waitForLoadState('networkidle')
  
  // Execute custom actions if specified
  if (screenshot.actions) {
    await screenshot.actions(page)
  }
  
  // Wait for specific selector or timeout
  if (typeof screenshot.waitFor === 'string') {
    await page.waitForSelector(screenshot.waitFor, { timeout: 10000 })
  } else if (typeof screenshot.waitFor === 'number') {
    await page.waitForTimeout(screenshot.waitFor)
  }
  
  // Additional wait to ensure everything is rendered
  await page.waitForTimeout(1000)
  
  // Capture screenshot
  const filename = `${screenshot.name}.png`
  const filepath = path.join(SCREENSHOT_DIR, filename)
  
  await page.screenshot({
    path: filepath,
    fullPage: false, // Capture viewport only for cleaner screenshots
  })
  
  console.log(`     ✅ Saved: ${filename}`)
}

async function main() {
  console.log('🚀 Starting portfolio screenshot capture\n')
  console.log(`📁 Screenshots will be saved to: ${SCREENSHOT_DIR}\n`)
  
  let browser: Browser | null = null
  
  try {
    // Launch browser
    console.log('🌐 Launching browser...')
    browser = await chromium.launch({
      headless: false, // Show browser for debugging
    })
    
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
    })
    
    const page = await context.newPage()
    
    // Login
    await login(page)
    
    console.log('\n📸 Capturing screenshots...\n')
    
    // Capture all screenshots
    for (let i = 0; i < screenshots.length; i++) {
      await captureScreenshot(page, screenshots[i], i)
      await page.waitForTimeout(500) // Small delay between captures
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ All screenshots captured successfully!')
    console.log(`📁 Location: ${SCREENSHOT_DIR}`)
    console.log(`📊 Total screenshots: ${screenshots.length}`)
    console.log('='.repeat(60) + '\n')
    
  } catch (error) {
    console.error('\n❌ Error capturing screenshots:', error)
    throw error
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

// Run the script
main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
