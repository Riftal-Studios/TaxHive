import type { Metadata } from 'next'

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
      <nav>
        {/* Basic navbar - will be enhanced in Task 1.2 */}
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>TaxHive</div>
            <div className="space-x-4">
              <a href="/features">Features</a>
              <a href="/pricing">Pricing</a>
              <a href="/blog">Blog</a>
              <a href="/auth/signin">Sign In</a>
              <a href="/auth/signup">Start Free Trial</a>
            </div>
          </div>
        </div>
      </nav>

      <main>{children}</main>

      <footer>
        {/* Basic footer - will be enhanced in Task 1.2 */}
        <div className="container mx-auto px-4 py-8">
          <p>&copy; {new Date().getFullYear()} TaxHive. All rights reserved.</p>
        </div>
      </footer>
    </>
  )
}
