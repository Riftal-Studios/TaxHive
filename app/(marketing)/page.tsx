import type { Metadata } from 'next'

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
      <section className="hero py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">
            GST-Compliant Invoicing for Indian Exporters
          </h1>
          <p className="text-xl mb-8">
            Generate LUT invoices with RBI exchange rates in seconds
          </p>

          <div className="space-x-4">
            <a
              href="/auth/signup"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              Start Free Trial
            </a>
            <a
              href="/features"
              className="inline-block border border-gray-300 px-6 py-3 rounded-md hover:border-gray-400"
            >
              Learn More
            </a>
          </div>

          <div className="mt-8 space-x-6 text-sm">
            <span>✓ GST Rule 46 Compliant</span>
            <span>✓ Zero-Rated Supply Support</span>
            <span>✓ Automatic RBI Rates</span>
          </div>
        </div>
      </section>

      {/* Features Section - Placeholder */}
      <section className="features py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Complete GST Compliance for Export Invoices
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="feature-card p-6">
              <h3 className="text-xl font-semibold mb-2">
                GST Rule 46 Compliance
              </h3>
              <p>Every invoice meets all GST Rule 46 requirements automatically.</p>
            </div>
            <div className="feature-card p-6">
              <h3 className="text-xl font-semibold mb-2">
                LUT Declaration Support
              </h3>
              <p>Automatic LUT declaration with your registered number.</p>
            </div>
            <div className="feature-card p-6">
              <h3 className="text-xl font-semibold mb-2">
                RBI Exchange Rates
              </h3>
              <p>Fetch current RBI reference rates automatically.</p>
            </div>
            <div className="feature-card p-6">
              <h3 className="text-xl font-semibold mb-2">Professional PDFs</h3>
              <p>Generate professional, compliant invoice PDFs instantly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section - Placeholder */}
      <section className="cta py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to simplify your GST invoicing?
          </h2>
          <p className="text-xl mb-8">
            Join hundreds of Indian exporters using TaxHive
          </p>
          <a
            href="/auth/signup"
            className="inline-block bg-blue-600 text-white px-8 py-4 rounded-md hover:bg-blue-700 text-lg"
          >
            Start Free Trial
          </a>
        </div>
      </section>
    </div>
  )
}
