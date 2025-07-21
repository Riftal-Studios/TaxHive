import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/trpc/server'

export default async function Dashboard() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/auth/signin')
  }

  // Fetch data server-side
  const [clients, invoices] = await Promise.all([
    api.clients.list(),
    api.invoices.list(),
  ])

  const totalRevenue = invoices.reduce((sum, inv) => {
    if (inv.status === 'PAID') {
      return sum + Number(inv.totalInINR)
    }
    return sum
  }, 0)

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to FreelanceHive</h2>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Manage your clients and invoices with GST compliance.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Clients</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{clients.length}</p>
              <Link
                href="/clients"
                className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
              >
                Manage clients →
              </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Invoices</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{invoices.length}</p>
              <Link
                href="/invoices"
                className="mt-4 inline-block text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
              >
                View invoices →
              </Link>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Revenue</h3>
              <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">₹{totalRevenue.toLocaleString('en-IN')}</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Total paid</p>
            </div>
          </div>
        </div>
      </main>
  )
}