import puppeteer from 'puppeteer'

async function testPublicInvoicePage() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()
  
  const token = '_dXZSGbfnHdB31LcE5bdaI-_LPCODxMl2hHmDv0ER2I'
  const url = `http://localhost:3000/invoice/${token}`
  
  console.log('Testing public invoice page:', url)
  
  try {
    await page.goto(url, { waitUntil: 'networkidle0' })
    
    // Check if we're on the invoice page or redirected to auth
    const currentUrl = page.url()
    console.log('Current URL:', currentUrl)
    
    if (currentUrl.includes('/auth/signin')) {
      console.error('❌ Page redirected to sign in - public access not working')
    } else {
      // Wait for invoice content
      const invoiceNumber = await page.$eval('h1', el => el.textContent).catch(() => null)
      console.log('✅ Public invoice page loaded!')
      console.log('Invoice number:', invoiceNumber)
      
      // Take a screenshot
      await page.screenshot({ path: 'public-invoice-test.png' })
      console.log('Screenshot saved to public-invoice-test.png')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
  }
}

testPublicInvoicePage()