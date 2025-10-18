import { MetadataRoute } from 'next'

/**
 * Robots.txt for TaxHive
 *
 * Defines crawling rules for search engine bots
 * - Allow all marketing pages
 * - Disallow authenticated app pages
 * - Disallow API endpoints
 *
 * Learn more: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://taxhive.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/features',
          '/pricing',
          // '/blog', // TODO: Add when blog is implemented (Task 5.1-5.3)
          '/auth/signin',
          '/auth/signup',
        ],
        disallow: [
          '/api/*',
          '/dashboard',
          '/invoices',
          '/clients',
          '/luts',
          '/payments',
          '/settings',
          '/onboarding',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
