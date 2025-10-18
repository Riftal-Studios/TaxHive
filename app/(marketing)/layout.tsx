import type { Metadata } from 'next'

/**
 * Marketing Layout - Public pages for unauthenticated users
 *
 * This layout wraps all marketing pages (landing page, features, pricing, blog)
 * Route group: (marketing) - doesn't affect URL structure
 *
 * Structure:
 * - Root layout (app/layout.tsx) provides html, body, providers
 * - Marketing layout (this file) adds navbar and footer
 * - Page content goes in {children}
 */

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://taxhive.app'),
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
        {/* Basic navbar - will be enhanced in Task 1.2 */}
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">TaxHive</div>
            <div className="hidden md:flex items-center space-x-6">
              <a href="/features" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Features
              </a>
              <a href="/pricing" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Pricing
              </a>
              <a href="/blog" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Blog
              </a>
              <a href="/auth/signin" className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                Sign In
              </a>
              <a href="/auth/signup" className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium">
                Start Free Trial
              </a>
            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer className="bg-gray-900 dark:bg-black text-gray-300">
        {/* Basic footer - will be enhanced in Task 1.2 */}
        <div className="container mx-auto px-4 py-8">
          <p className="text-center">&copy; {new Date().getFullYear()} TaxHive. All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}
