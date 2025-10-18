import type { Metadata } from 'next'

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
  openGraph: {
    title: 'TaxHive - GST Invoice Management',
    description: 'GST-compliant invoicing for Indian exporters',
    url: 'https://taxhive.app',
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
  return (
    <div className="landing-page">
      {/* Hero Section - Basic implementation for tests */}
      <section className="hero py-20 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-gray-900 dark:text-gray-50">
            GST-Compliant Invoicing for Indian Exporters
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Generate LUT invoices with RBI exchange rates in seconds
          </p>

          <div className="space-x-4">
            <a
              href="/auth/signup"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm hover:shadow-md"
            >
              Start Free Trial
            </a>
            <a
              href="/features"
              className="inline-block border-2 border-gray-300 dark:border-gray-600 px-6 py-3 rounded-lg hover:border-indigo-600 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
            >
              Learn More
            </a>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              GST Rule 46 Compliant
            </span>
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Zero-Rated Supply Support
            </span>
            <span className="flex items-center">
              <svg className="w-5 h-5 mr-2 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Automatic RBI Rates
            </span>
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
            <div className="feature-card bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                GST Rule 46 Compliance
              </h3>
              <p className="text-gray-600 dark:text-gray-400">Every invoice meets all GST Rule 46 requirements automatically.</p>
            </div>
            <div className="feature-card bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                LUT Declaration Support
              </h3>
              <p className="text-gray-600 dark:text-gray-400">Automatic LUT declaration with your registered number.</p>
            </div>
            <div className="feature-card bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                RBI Exchange Rates
              </h3>
              <p className="text-gray-600 dark:text-gray-400">Fetch current RBI reference rates automatically.</p>
            </div>
            <div className="feature-card bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">Professional PDFs</h3>
              <p className="text-gray-600 dark:text-gray-400">Generate professional, compliant invoice PDFs instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Placeholder */}
      <section className="cta py-16 bg-indigo-600 dark:bg-indigo-800">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
            Ready to simplify your GST invoicing?
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            Join hundreds of Indian exporters using TaxHive
          </p>
          <a
            href="/auth/signup"
            className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg hover:bg-gray-50 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
          >
            Start Free Trial
          </a>
        </div>
      </section>
    </div>
  )
}
