import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  icon?: React.ComponentType<{ className?: string }>
  loading?: boolean
}

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg animate-pulse">
        <div className="p-5">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-12 w-12 bg-gray-300 dark:bg-gray-600 rounded-md"></div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {Icon && (
              <div className="bg-indigo-500 rounded-md p-3">
                <Icon className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
                {title}
              </dt>
              <dd className="flex items-baseline">
                <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {value}
                </div>
                {trend && (
                  <div
                    className={`ml-2 flex items-baseline text-sm font-semibold ${
                      trend.isPositive
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {trend.isPositive ? (
                      <ArrowUpIcon className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span className="ml-1">{Math.abs(trend.value)}%</span>
                  </div>
                )}
              </dd>
              {subtitle && (
                <dd className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {subtitle}
                </dd>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}