import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing - TaxHive',
  description:
    'Simple, transparent pricing for TaxHive. Start with a free trial and choose a plan that fits your export business.',
}

export default function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: 'Free',
      period: 'forever',
      description: 'Perfect for getting started with export invoicing',
      features: [
        'Up to 10 invoices per month',
        'GST Rule 46 compliant invoices',
        'LUT declaration support',
        'RBI exchange rates',
        'PDF generation',
        'Basic client management',
        'Email support',
      ],
      cta: 'Start Free',
      ctaLink: '/auth/signup',
      highlighted: false,
      comingSoon: false,
    },
    {
      name: 'Professional',
      price: '₹999',
      period: 'per month',
      description: 'For growing export businesses',
      features: [
        'Unlimited invoices',
        'Everything in Starter, plus:',
        'Payment tracking',
        'Payment reminders',
        'Custom branding',
        'Advanced reporting',
        'Priority email support',
        'Phone support',
      ],
      cta: 'Coming Soon',
      ctaLink: '#',
      highlighted: true,
      comingSoon: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'contact us',
      description: 'For large export businesses with custom needs',
      features: [
        'Everything in Professional, plus:',
        'Custom integrations',
        'Dedicated account manager',
        'API access',
        'Custom workflows',
        'Advanced permissions',
        'SLA guarantee',
        '24/7 priority support',
      ],
      cta: 'Coming Soon',
      ctaLink: '#',
      highlighted: false,
      comingSoon: true,
    },
  ]

  return (
    <div className="pricing-page">
      {/* Hero Section */}
      <section className="py-16 bg-gradient-to-b from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-gray-50">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Choose the plan that fits your export business. Start free, upgrade anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden ${
                  plan.comingSoon ? 'opacity-60' : ''
                } ${
                  plan.highlighted && !plan.comingSoon
                    ? 'ring-2 ring-indigo-600 dark:ring-indigo-400 transform scale-105'
                    : 'border border-gray-200 dark:border-gray-700'
                }`}
              >
                {plan.comingSoon && (
                  <div className="bg-gray-500 text-white text-center py-2 text-sm font-medium">
                    Coming Soon
                  </div>
                )}
                {plan.highlighted && !plan.comingSoon && (
                  <div className="bg-indigo-600 text-white text-center py-2 text-sm font-medium">
                    Most Popular
                  </div>
                )}
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-50">
                    {plan.name}
                  </h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-gray-50">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        / {plan.period}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {plan.description}
                  </p>
                  {plan.comingSoon ? (
                    <button
                      disabled
                      className="block w-full text-center py-3 px-6 rounded-lg font-medium bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-500"
                    >
                      {plan.cta}
                    </button>
                  ) : (
                    <Link
                      href={plan.ctaLink}
                      className={`block w-full text-center py-3 px-6 rounded-lg font-medium transition-colors ${
                        plan.highlighted
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {plan.cta}
                    </Link>
                  )}
                  <ul className="mt-8 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start text-gray-600 dark:text-gray-400"
                      >
                        <svg
                          className="w-5 h-5 mr-3 mt-0.5 text-emerald-500 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-gray-50">
            Frequently Asked Questions
          </h2>
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                Can I switch plans anytime?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                Is there a free trial?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Yes! All paid plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We accept all major credit/debit cards, UPI, and net banking through our secure payment gateway.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                Do you offer refunds?
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Yes, we offer a 30-day money-back guarantee if you&apos;re not satisfied with TaxHive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-indigo-600 dark:bg-indigo-800">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">
            Ready to get started?
          </h2>
          <p className="text-xl mb-8 text-indigo-100">
            Start your free trial today. No credit card required.
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
