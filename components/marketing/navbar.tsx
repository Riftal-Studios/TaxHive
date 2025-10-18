import Link from 'next/link'

/**
 * Marketing Navbar Component
 *
 * Public-facing navigation for unauthenticated users
 * Features:
 * - Sticky positioning for persistent access
 * - Primary brand color (indigo-600)
 * - Dark mode support
 * - Responsive (desktop-first, mobile menu to be added)
 *
 * Links:
 * - Features, Pricing (marketing pages - placeholders for now)
 * - Sign In (authentication)
 * - Start Free Trial (CTA to signup)
 *
 * Note: Blog link will be added when blog is implemented (Task 5.1-5.3)
 */

const navLinks = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  // TODO: Add blog link when blog is implemented (Task 5.1-5.3)
  // { href: '/blog', label: 'Blog' },
]

export function MarketingNavbar() {
  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Brand/Logo */}
          <Link
            href="/"
            className="text-xl font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            TaxHive
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {/* Marketing Links */}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}

            {/* Auth Links */}
            <Link
              href="/auth/signin"
              className="text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium"
            >
              Sign In
            </Link>

            {/* Primary CTA */}
            <Link
              href="/auth/signup"
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm hover:shadow-md"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile Menu Button - To be implemented in future task */}
          <div className="md:hidden">
            {/* TODO: Add mobile menu hamburger icon */}
          </div>
        </div>
      </div>
    </nav>
  )
}
