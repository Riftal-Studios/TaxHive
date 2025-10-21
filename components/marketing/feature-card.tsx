import React from 'react'

interface FeatureCardProps {
  icon: React.ReactElement
  iconBgColor: 'indigo' | 'emerald' | 'blue' | 'purple' | 'green'
  title: string
  description: string
}

export function FeatureCard({ icon, iconBgColor, title, description }: FeatureCardProps) {
  const bgColorClasses = {
    indigo: 'bg-indigo-100 dark:bg-indigo-900',
    emerald: 'bg-emerald-100 dark:bg-emerald-900',
    blue: 'bg-blue-100 dark:bg-blue-900',
    purple: 'bg-purple-100 dark:bg-purple-900',
    green: 'bg-green-100 dark:bg-green-900',
  }

  const iconColorClasses = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
  }

  // Clone the icon element and add the color classes
  const iconWithClasses = React.cloneElement(icon, {
    className: `w-6 h-6 ${iconColorClasses[iconBgColor]}`,
  } as React.SVGProps<SVGSVGElement>)

  return (
    <div className="feature-card bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 ${bgColorClasses[iconBgColor]} rounded-lg flex items-center justify-center mb-4`}>
        {iconWithClasses}
      </div>
      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
        {title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400">{description}</p>
    </div>
  )
}
