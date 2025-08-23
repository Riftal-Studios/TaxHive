import puppeteer from 'puppeteer'
import { Logger } from '../../lib/logger'

async function testPublicInvoicePage() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  
  const token = '_dXZSGbfnHdB31LcE5bdaI-_LPCODxMl2hHmDv0ER2I'
  const url = `http://localhost:3000/invoice/${token}`
  
  Logger.info('Testing public invoice page:', url)
  
  try {
    await page.goto(url, { waitUntil: 'networkidle0' })
    
    // Check if we're on the invoice page or redirected to auth
    const currentUrl = page.url()
    Logger.info('Current URL:', currentUrl)
    
    if (currentUrl.includes('/auth/signin')) {
      Logger.error('❌ Page redirected to sign in - public access not working')
    } else {
      // Wait for invoice content
      const invoiceNumber = await page.$eval('h1', el => el.textContent).catch(() => null)
      Logger.info('✅ Public invoice page loaded!')
      Logger.info('Invoice number:', invoiceNumber)
      
      // Take a screenshot
      await page.screenshot({ path: 'public-invoice-test.png' })
      Logger.info('Screenshot saved to public-invoice-test.png')
    }
  } catch (error) {
    Logger.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testPublicInvoicePage()