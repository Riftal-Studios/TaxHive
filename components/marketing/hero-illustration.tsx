export function HeroIllustration() {
  return (
    <div className="relative w-full max-w-2xl">
      <div className="aspect-video bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 rounded-lg shadow-2xl overflow-hidden border-2 border-gray-200 dark:border-gray-700">
        {/* SVG Invoice Illustration */}
        <svg
          className="w-full h-full p-8"
          viewBox="0 0 800 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="TaxHive invoice dashboard showing GST-compliant export invoices with LUT declarations and RBI exchange rates"
        >
          {/* Invoice document */}
          <rect x="100" y="80" width="600" height="440" rx="8" className="fill-white dark:fill-gray-800" />

          {/* Header section */}
          <rect x="120" y="100" width="200" height="30" rx="4" className="fill-indigo-600" />

          {/* Content lines */}
          <rect x="120" y="150" width="560" height="15" rx="3" className="fill-gray-300 dark:fill-gray-600" />
          <rect x="120" y="180" width="400" height="15" rx="3" className="fill-gray-300 dark:fill-gray-600" />

          {/* Invoice items */}
          <rect x="120" y="220" width="560" height="15" rx="3" className="fill-gray-200 dark:fill-gray-700" />
          <rect x="120" y="250" width="560" height="15" rx="3" className="fill-gray-200 dark:fill-gray-700" />
          <rect x="120" y="280" width="560" height="15" rx="3" className="fill-gray-200 dark:fill-gray-700" />

          {/* LUT declaration badge */}
          <rect x="120" y="330" width="300" height="20" rx="4" className="fill-emerald-500" />

          {/* Total/INVOICE label */}
          <rect x="500" y="450" width="180" height="50" rx="6" className="fill-indigo-600" />
          <text x="520" y="480" className="fill-white text-2xl font-bold">INVOICE</text>
        </svg>
      </div>

      {/* Decorative blur elements */}
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-500 rounded-full opacity-20 blur-2xl" aria-hidden="true"></div>
      <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-indigo-500 rounded-full opacity-20 blur-2xl" aria-hidden="true"></div>
    </div>
  )
}
