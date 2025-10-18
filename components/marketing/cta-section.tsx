interface CTASectionProps {
  headline: string
  description: string
  buttonText: string
  buttonHref: string
}

export function CTASection({ headline, description, buttonText, buttonHref }: CTASectionProps) {
  return (
    <section className="cta py-16 bg-indigo-600 dark:bg-indigo-800">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
          {headline}
        </h2>
        <p className="text-xl mb-8 text-indigo-100">
          {description}
        </p>
        <a
          href={buttonHref}
          className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg hover:bg-gray-50 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
        >
          {buttonText}
        </a>
      </div>
    </section>
  )
}
