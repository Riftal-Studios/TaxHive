import type { Metadata } from 'next'
import { TrustBadge } from '@/components/marketing/trust-badge'
import { HeroIllustration } from '@/components/marketing/hero-illustration'
import { FeatureCard } from '@/components/marketing/feature-card'
import { CTASection } from '@/components/marketing/cta-section'

/**
 * Landing Page - Main marketing page for TaxHive
 *
 * This is the root route (/) for unauthenticated users
 * SEO-optimized with comprehensive meta tags for search engines
 *
 * Sections:
 * - Hero: Main value proposition with CTAs
 * - Features: Key product features (GST compliance, LUT, RBI rates, PDFs)
 * - CTA: Final conversion section
 *
 * Note: Authenticated users are redirected to /dashboard via middleware
 */

export const metadata: Metadata = {
  metadataBase: new URL('https://taxhive.app'),
  title: 'TaxHive - GST-Compliant Invoice Management for Indian Exporters',
  description:
    'Generate GST Rule 46 compliant invoices with LUT support, RBI exchange rates, and professional PDF generation for export businesses.',
  keywords: [
    'GST invoice',
    'LUT invoice',
    'export invoice India',
    'GST compliance',
    'zero-rated supplies',
  ],
  alternates: {
    canonical: 'https://taxhive.app',
  },
  openGraph: {
    type: 'website',
    title: 'TaxHive - GST Invoice Management',
    description: 'GST-compliant invoicing for Indian exporters',
    url: 'https://taxhive.app',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'TaxHive - GST-Compliant Invoice Management',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaxHive',
    description: 'GST-compliant invoicing made simple',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function LandingPage() {
  // Structured data for SEO (JSON-LD)
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TaxHive',
    url: 'https://taxhive.app',
    logo: 'https://taxhive.app/logo.png',
    description:
      'GST-compliant invoice management system for Indian businesses exporting services',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'IN',
    },
    sameAs: [],
  }

  const softwareApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'TaxHive',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      description: 'Free trial available',
    },
    description:
      'Generate GST Rule 46 compliant invoices with LUT support, RBI exchange rates, and professional PDF generation for export businesses.',
    featureList: [
      'GST Rule 46 Compliance',
      'LUT Declaration Support',
      'RBI Exchange Rates',
      'Professional PDF Generation',
      'Zero-Rated Supply Support',
    ],
    screenshot: 'https://taxhive.app/screenshot.png',
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TaxHive',
    url: 'https://taxhive.app',
    description: 'GST-Compliant Invoice Management for Indian Exporters',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://taxhive.app/search?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      {/* Structured Data - JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      <div className="landing-page">
      {/* Hero Section - Enhanced with trust badges and imagery */}
      <section className="hero py-20 bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <div className="text-center lg:text-left">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-gray-900 dark:text-gray-50">
                GST-Compliant Invoicing for Indian Exporters
              </h1>
              <p className="text-xl md:text-2xl mb-8 text-gray-600 dark:text-gray-300">
                Professional invoice management for export businesses. Generate GST Rule 46 compliant invoices with LUT declarations and RBI exchange rates in seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                <a
                  href="/auth/signup"
                  className="inline-block bg-indigo-600 text-white px-8 py-4 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm hover:shadow-md text-center"
                >
                  Start Free Trial
                </a>
                <a
                  href="/features"
                  className="inline-block border-2 border-gray-300 dark:border-gray-600 px-8 py-4 rounded-lg hover:border-indigo-600 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium text-center"
                >
                  Learn More
                </a>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-gray-600 dark:text-gray-400">
                <TrustBadge
                  icon={
                    <svg className="w-5 h-5 mr-2 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  text="GST Rule 46 Compliant"
                />
                <TrustBadge
                  icon={
                    <svg className="w-5 h-5 mr-2 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  text="LUT Support"
                />
                <TrustBadge
                  icon={
                    <svg className="w-5 h-5 mr-2 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  text="RBI Exchange Rates"
                />
              </div>
            </div>

            {/* Hero Image */}
            <div className="flex justify-center lg:justify-end">
              <HeroIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Placeholder */}
      <section className="features py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-gray-900 dark:text-gray-50">
            Complete GST Compliance for Export Invoices
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              iconBgColor="indigo"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="GST Rule 46 Compliance"
              description="Every invoice meets all GST Rule 46 requirements automatically."
            />
            <FeatureCard
              iconBgColor="emerald"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              title="LUT Declaration Support"
              description="Automatic LUT declaration with your registered number."
            />
            <FeatureCard
              iconBgColor="blue"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="RBI Exchange Rates"
              description="Fetch current RBI reference rates automatically."
            />
            <FeatureCard
              iconBgColor="purple"
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
              title="Professional PDFs"
              description="Generate professional, compliant invoice PDFs instantly."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <CTASection
        headline="Ready to simplify your GST invoicing?"
        description="Join hundreds of Indian exporters using TaxHive"
        buttonText="Start Free Trial"
        buttonHref="/auth/signup"
      />
      </div>
    </>
  )
}
