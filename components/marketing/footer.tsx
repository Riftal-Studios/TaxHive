/**
 * Marketing Footer Component
 *
 * Public-facing footer for all marketing pages
 * Features:
 * - Dark background for contrast
 * - Copyright information
 * - Company info and links (to be expanded)
 * - Responsive layout
 */

export function MarketingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 dark:bg-black text-gray-300">
      <div className="container mx-auto px-4 py-8">
        {/* Simple copyright for now - will be expanded in future tasks */}
        <div className="text-center">
          <p className="text-sm">
            &copy; {currentYear} TaxHive. All rights reserved.
          </p>
        </div>

        {/* TODO: Add footer sections in future task:
         * - Product links (Features, Pricing, etc.)
         * - Company links (About, Contact, etc.)
         * - Legal links (Privacy, Terms, etc.)
         * - Social media links
         */}
      </div>
    </footer>
  )
}
