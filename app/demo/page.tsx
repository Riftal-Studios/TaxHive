export const dynamic = 'force-static'

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            TaxHive
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Enterprise SaaS Platform for GST-Compliant Export Invoice Management
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="/auth/signin"
              className="inline-block rounded-md bg-indigo-600 px-8 py-3 text-white font-medium hover:bg-indigo-700 transition"
            >
              Try Demo
            </a>
            <a
              href="https://github.com"
              className="inline-block rounded-md border border-gray-300 dark:border-gray-600 px-8 py-3 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              View Documentation
            </a>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Demo Credentials
          </h2>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-6 font-mono text-sm">
            <p className="mb-2">
              <span className="text-gray-600 dark:text-gray-400">Email:</span>{' '}
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">demo@taxhive.app</span>
            </p>
            <p>
              <span className="text-gray-600 dark:text-gray-400">Password:</span>{' '}
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Demo123!</span>
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Type-Safe API
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              End-to-end type safety with tRPC and TypeScript. 8 routers, 100+ procedures.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Multi-Tenant SaaS
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Complete data isolation with PostgreSQL + Prisma ORM. Optimized for scalability.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Queue Processing
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              BullMQ + Redis for async operations. PDF generation, email notifications.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              GST Compliance
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Automated GST Rule 46 validation, LUT management, SAC/HSN code handling.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Multi-Currency
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Support for USD, EUR, GBP, CAD, AUD with RBI API integration for exchange rates.
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
              Payment Tracking
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Complete payment reconciliation with FIRC documentation and variance analysis.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Tech Stack
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['Next.js 14', 'TypeScript', 'tRPC', 'React', 'Prisma ORM', 'PostgreSQL', 'BullMQ', 'Redis', 'NextAuth.js', 'Puppeteer', 'Material-UI', 'Tailwind CSS'].map((tech) => (
              <div key={tech} className="bg-gray-50 dark:bg-gray-900 rounded-md px-4 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                {tech}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center mt-12 text-gray-600 dark:text-gray-400">
          <p>Portfolio project showcasing full-stack development with backend architecture focus</p>
        </div>
      </div>
    </div>
  )
}
