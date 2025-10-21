import { test, expect } from '@playwright/test'

test.describe('Landing Page - Structured Data (JSON-LD)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page should have Organization schema', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let hasOrganizationSchema = false
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'Organization') {
          hasOrganizationSchema = true
          break
        }
      }
    }

    expect(hasOrganizationSchema).toBeTruthy()
  })

  test('Organization schema should have name "TaxHive"', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let organizationName = ''
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'Organization') {
          organizationName = schema.name
          break
        }
      }
    }

    expect(organizationName).toBe('TaxHive')
  })

  test('Organization schema should have valid structure', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let organizationSchema: any = null
    for (const script of scripts) {
      const content = await script.textContent()
      if (content && content.includes('"@type":"Organization"')) {
        organizationSchema = JSON.parse(content)
        break
      }
    }

    expect(organizationSchema).toBeTruthy()
    expect(organizationSchema['@context']).toBe('https://schema.org')
    expect(organizationSchema['@type']).toBe('Organization')
    expect(organizationSchema.name).toBeTruthy()
    expect(organizationSchema.url).toBeTruthy()
  })

  test('page should have SoftwareApplication schema', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let hasSoftwareSchema = false
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'SoftwareApplication') {
          hasSoftwareSchema = true
          break
        }
      }
    }

    expect(hasSoftwareSchema).toBeTruthy()
  })

  test('SoftwareApplication schema should have correct category', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let applicationCategory = ''
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'SoftwareApplication') {
          applicationCategory = schema.applicationCategory
          break
        }
      }
    }

    expect(applicationCategory).toBe('BusinessApplication')
  })

  test('SoftwareApplication schema should include offers/pricing info', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let offers: any = null
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'SoftwareApplication') {
          offers = schema.offers
          break
        }
      }
    }

    expect(offers).toBeTruthy()
    expect(offers['@type']).toBe('Offer')
    expect(offers.price).toBeDefined()
    expect(offers.priceCurrency).toBeDefined()
  })

  test('SoftwareApplication schema should include feature list', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let featureList: any = null
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'SoftwareApplication') {
          featureList = schema.featureList
          break
        }
      }
    }

    expect(featureList).toBeTruthy()
    expect(Array.isArray(featureList)).toBeTruthy()
    expect(featureList.length).toBeGreaterThanOrEqual(4)
  })

  test('JSON-LD should be valid (parse without errors)', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    for (const script of scripts) {
      const content = await script.textContent()

      // Should parse without throwing
      expect(() => {
        JSON.parse(content!)
      }).not.toThrow()
    }

    // Should have at least 2 schemas (Organization + SoftwareApplication)
    expect(scripts.length).toBeGreaterThanOrEqual(2)
  })

  test('page should have WebSite schema', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let hasWebSiteSchema = false
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'WebSite') {
          hasWebSiteSchema = true
          break
        }
      }
    }

    expect(hasWebSiteSchema).toBeTruthy()
  })

  test('all schemas should have @context and @type', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    for (const script of scripts) {
      const content = await script.textContent()
      const schema = JSON.parse(content!)

      expect(schema['@context']).toBeTruthy()
      expect(schema['@type']).toBeTruthy()
    }
  })

  test('Organization schema should include address with country', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let address: any = null
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'Organization') {
          address = schema.address
          break
        }
      }
    }

    expect(address).toBeTruthy()
    expect(address.addressCountry).toBe('IN')
  })

  test('SoftwareApplication schema should mention GST in description', async ({ page }) => {
    const scripts = await page.locator('script[type="application/ld+json"]').all()

    let description = ''
    for (const script of scripts) {
      const content = await script.textContent()
      if (content) {
        const schema = JSON.parse(content)
        if (schema['@type'] === 'SoftwareApplication') {
          description = schema.description
          break
        }
      }
    }

    expect(description).toBeTruthy()
    expect(/gst|invoice/i.test(description)).toBeTruthy()
  })
})
