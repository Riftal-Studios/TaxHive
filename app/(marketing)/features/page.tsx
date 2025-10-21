import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Features - TaxHive',
  description:
    'Discover all the powerful features of TaxHive for GST-compliant invoice management, LUT support, RBI exchange rates, and professional PDF generation.',
}

export default function FeaturesPage() {
  const features = [
    {
      category: 'GST Compliance',
      items: [
        {
          title: 'GST Rule 46 Compliance',
          description: 'Every invoice automatically meets all GST Rule 46 requirements for export invoices.',
        },
        {
          title: 'LUT Declaration Support',
          description: 'Automatic LUT declaration on invoices with your registered LUT number and date.',
        },
        {
          title: 'Zero-Rated Supply',
          description: 'Proper handling of zero-rated supplies for export services with 0% IGST.',
        },
        {
          title: 'HSN/SAC Codes',
          description: 'Support for 8-digit HSN/SAC codes required for export invoices.',
        },
      ],
    },
    {
      category: 'Invoice Management',
      items: [
        {
          title: 'Professional PDF Generation',
          description: 'Generate beautiful, compliant invoice PDFs with your company branding.',
        },
        {
          title: 'Sequential Invoice Numbers',
          description: 'Automatic FY{YY-YY}/{NUMBER} format invoice numbering as per GST rules.',
        },
        {
          title: 'Multi-Currency Support',
          description: 'Invoice in foreign currencies with automatic INR conversion.',
        },
        {
          title: 'Client Management',
          description: 'Organize and manage all your international clients in one place.',
        },
      ],
    },
    {
      category: 'Exchange Rates',
      items: [
        {
          title: 'RBI Reference Rates',
          description: 'Fetch official RBI reference exchange rates automatically.',
        },
        {
          title: 'Daily Rate Updates',
          description: 'Exchange rates updated daily via automated cron jobs.',
        },
        {
          title: 'Manual Override',
          description: 'Override exchange rates when needed for specific invoices.',
        },
        {
          title: 'Rate History',
          description: 'Track historical exchange rates for all your invoices.',
        },
      ],
    },
    {
      category: 'Payment Tracking',
      items: [
        {
          title: 'Payment Status',
          description: 'Track payment status: Draft, Sent, Viewed, Paid, Partially Paid, Overdue.',
        },
        {
          title: 'Payment Records',
          description: 'Record multiple payments against a single invoice.',
        },
        {
          title: 'Outstanding Balance',
          description: 'Automatic calculation of outstanding amounts and due dates.',
        },
        {
          title: 'Payment Reminders',
          description: 'Email reminders for pending and overdue invoices.',
        },
      ],
    },
  ]

  return (
    <div className="features-page">
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-gray-50">
              Everything You Need for GST-Compliant Export Invoicing
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              TaxHive provides all the tools Indian exporters need to create professional,
              compliant invoices for international clients.
            </p>
            <Link
              href="/auth/signup"
              className="inline-block bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm hover:shadow-md"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          {features.map((category, idx) => (
            <div key={category.category} className={idx > 0 ? 'mt-16' : ''}>
              <h2 className="text-3xl font-bold mb-8 text-gray-900 dark:text-gray-50">
                {category.category}
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {category.items.map((feature) => (
                  <div
                    key={feature.title}
                    className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-600 dark:hover:border-indigo-400 transition-colors"
                  >
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-indigo-600 dark:bg-indigo-800">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">
            Ready to streamline your export invoicing?
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            Join hundreds of Indian exporters using TaxHive
          </p>
          <Link
            href="/auth/signup"
            className="inline-block bg-white text-indigo-600 px-8 py-3 rounded-lg hover:bg-gray-50 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
          >
            Start Free Trial
          </Link>
        </div>
      </section>
    </div>
  )
}
