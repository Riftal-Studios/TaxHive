import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  Suite,
  FullConfig,
} from '@playwright/test/reporter'
import * as fs from 'fs'
import * as path from 'path'

interface ErrorEntry {
  testFile: string
  testTitle: string
  error: string
  stack?: string
  category: 'assertion' | 'timeout' | 'network' | 'console' | 'crash' | 'other'
  screenshots: string[]
  duration: number
}

interface ErrorSummary {
  timestamp: string
  totalTests: number
  passedTests: number
  failedTests: number
  skippedTests: number
  errors: ErrorEntry[]
  errorsByCategory: Record<string, number>
  errorsByFile: Record<string, ErrorEntry[]>
  uiIssues: string[]
}

/**
 * Custom Playwright reporter that aggregates all errors across tests
 * and generates a comprehensive error summary
 */
export default class ErrorSummaryReporter implements Reporter {
  private errors: ErrorEntry[] = []
  private totalTests = 0
  private passedTests = 0
  private failedTests = 0
  private skippedTests = 0
  private outputDir = 'test-results'
  private uiIssues: string[] = []

  onBegin(config: FullConfig, suite: Suite): void {
    this.outputDir = config.projects[0]?.outputDir || 'test-results'
    console.log(`\nRunning ${suite.allTests().length} tests with error recording...\n`)
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.totalTests++

    if (result.status === 'passed') {
      this.passedTests++
      return
    }

    if (result.status === 'skipped') {
      this.skippedTests++
      return
    }

    // Test failed or timed out
    this.failedTests++

    const error = result.error
    if (!error) return

    const errorEntry: ErrorEntry = {
      testFile: test.location.file,
      testTitle: test.title,
      error: error.message || 'Unknown error',
      stack: error.stack,
      category: this.categorizeError(error),
      screenshots: result.attachments
        .filter(a => a.contentType?.startsWith('image/'))
        .map(a => a.path || ''),
      duration: result.duration,
    }

    this.errors.push(errorEntry)

    // Detect potential UI issues from error messages
    this.detectUIIssues(error.message, test.title)
  }

  onEnd(result: FullResult): void {
    const summary: ErrorSummary = {
      timestamp: new Date().toISOString(),
      totalTests: this.totalTests,
      passedTests: this.passedTests,
      failedTests: this.failedTests,
      skippedTests: this.skippedTests,
      errors: this.errors,
      errorsByCategory: this.groupByCategory(),
      errorsByFile: this.groupByFile(),
      uiIssues: [...new Set(this.uiIssues)],
    }

    // Ensure output directory exists
    const outputPath = path.resolve(this.outputDir)
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true })
    }

    // Write JSON summary
    const jsonPath = path.join(outputPath, 'error-summary.json')
    fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2))

    // Write human-readable summary
    const readablePath = path.join(outputPath, 'error-summary.txt')
    fs.writeFileSync(readablePath, this.formatReadableSummary(summary))

    // Print summary to console
    this.printConsoleSummary(summary)
  }

  private categorizeError(error: { message: string; stack?: string }): ErrorEntry['category'] {
    const message = error.message.toLowerCase()
    const stack = error.stack?.toLowerCase() || ''

    if (message.includes('timeout') || message.includes('exceeded')) {
      return 'timeout'
    }
    if (message.includes('expect') || message.includes('assert') || message.includes('tobevisible') || message.includes('tohave')) {
      return 'assertion'
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('api') || message.includes('500') || message.includes('404')) {
      return 'network'
    }
    if (message.includes('console') || stack.includes('console')) {
      return 'console'
    }
    if (message.includes('crash') || message.includes('fatal')) {
      return 'crash'
    }
    return 'other'
  }

  private detectUIIssues(errorMessage: string, testTitle: string): void {
    const message = errorMessage.toLowerCase()

    if (message.includes('not visible') || message.includes('hidden')) {
      this.uiIssues.push(`Element visibility issue in "${testTitle}"`)
    }
    if (message.includes('not found') || message.includes('no element')) {
      this.uiIssues.push(`Missing element in "${testTitle}"`)
    }
    if (message.includes('aria') || message.includes('accessibility')) {
      this.uiIssues.push(`Accessibility issue in "${testTitle}"`)
    }
    if (message.includes('label') && message.includes('missing')) {
      this.uiIssues.push(`Missing label in "${testTitle}"`)
    }
    if (message.includes('role')) {
      this.uiIssues.push(`Role-based selector issue in "${testTitle}"`)
    }
    if (message.includes('locator') && message.includes('strict')) {
      this.uiIssues.push(`Multiple matching elements in "${testTitle}"`)
    }
  }

  private groupByCategory(): Record<string, number> {
    const groups: Record<string, number> = {}
    for (const error of this.errors) {
      groups[error.category] = (groups[error.category] || 0) + 1
    }
    return groups
  }

  private groupByFile(): Record<string, ErrorEntry[]> {
    const groups: Record<string, ErrorEntry[]> = {}
    for (const error of this.errors) {
      const file = path.basename(error.testFile)
      if (!groups[file]) {
        groups[file] = []
      }
      groups[file].push(error)
    }
    return groups
  }

  private formatReadableSummary(summary: ErrorSummary): string {
    const lines: string[] = []

    lines.push('=' .repeat(60))
    lines.push('ERROR SUMMARY REPORT')
    lines.push('=' .repeat(60))
    lines.push(`Generated: ${summary.timestamp}`)
    lines.push('')
    lines.push('TEST RESULTS')
    lines.push('-'.repeat(30))
    lines.push(`Total:   ${summary.totalTests}`)
    lines.push(`Passed:  ${summary.passedTests}`)
    lines.push(`Failed:  ${summary.failedTests}`)
    lines.push(`Skipped: ${summary.skippedTests}`)
    lines.push('')

    if (Object.keys(summary.errorsByCategory).length > 0) {
      lines.push('ERRORS BY CATEGORY')
      lines.push('-'.repeat(30))
      for (const [category, count] of Object.entries(summary.errorsByCategory)) {
        lines.push(`${category.toUpperCase()}: ${count}`)
      }
      lines.push('')
    }

    if (summary.uiIssues.length > 0) {
      lines.push('UI/UX ISSUES DETECTED')
      lines.push('-'.repeat(30))
      for (const issue of summary.uiIssues) {
        lines.push(`- ${issue}`)
      }
      lines.push('')
    }

    if (summary.errors.length > 0) {
      lines.push('DETAILED ERRORS')
      lines.push('-'.repeat(30))
      for (const error of summary.errors) {
        lines.push('')
        lines.push(`Test: ${error.testTitle}`)
        lines.push(`File: ${path.basename(error.testFile)}`)
        lines.push(`Category: ${error.category}`)
        lines.push(`Duration: ${error.duration}ms`)
        lines.push(`Error: ${error.error}`)
        if (error.screenshots.length > 0) {
          lines.push(`Screenshots: ${error.screenshots.join(', ')}`)
        }
      }
    }

    lines.push('')
    lines.push('=' .repeat(60))
    lines.push('END OF REPORT')
    lines.push('=' .repeat(60))

    return lines.join('\n')
  }

  private printConsoleSummary(summary: ErrorSummary): void {
    console.log('\n' + '='.repeat(60))
    console.log('TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`\nTotal: ${summary.totalTests} | Passed: ${summary.passedTests} | Failed: ${summary.failedTests} | Skipped: ${summary.skippedTests}`)

    if (summary.failedTests > 0) {
      console.log('\nErrors by category:')
      for (const [category, count] of Object.entries(summary.errorsByCategory)) {
        console.log(`  ${category}: ${count}`)
      }

      if (summary.uiIssues.length > 0) {
        console.log('\nUI/UX issues detected:')
        for (const issue of summary.uiIssues.slice(0, 5)) {
          console.log(`  - ${issue}`)
        }
        if (summary.uiIssues.length > 5) {
          console.log(`  ... and ${summary.uiIssues.length - 5} more`)
        }
      }

      console.log(`\nFull report: ${path.join(this.outputDir, 'error-summary.json')}`)
    }
    console.log('')
  }
}
