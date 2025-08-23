import winston from 'winston';

/**
 * Enhanced logger configuration with security-conscious design
 * - Different log levels: error, warn, info, debug
 * - Only logs to console in development
 * - Sanitizes sensitive data
 * - Proper TypeScript types
 */

// Define sensitive data patterns that should never be logged
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /auth/i,
  /credential/i,
  /api[_-]?key/i,
  /bearer/i,
  /gstin/i, // GST identification numbers
  /pan/i,   // PAN numbers
  /email/i, // Email addresses for privacy
];

/**
 * Sanitizes data to remove sensitive information before logging
 */
function sanitizeData(data: any): any {
  if (typeof data === 'string') {
    // Check if the string itself contains sensitive patterns
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(data)) {
        return '[REDACTED]';
      }
    }
    return data;
  }

  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    // Check if the key contains sensitive patterns
    const isSensitiveKey = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
    
    if (isSensitiveKey) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeData(value);
    }
  }
  
  return sanitized;
}

/**
 * Custom log format with timestamp and sanitization
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const sanitizedMeta = Object.keys(meta).length ? sanitizeData(meta) : '';
    const metaString = sanitizedMeta ? ` ${JSON.stringify(sanitizedMeta)}` : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaString}`;
  })
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: logFormat,
  transports: [
    // Only log to console in development or if explicitly enabled
    ...(process.env.NODE_ENV === 'development' || process.env.ENABLE_CONSOLE_LOGGING === 'true'
      ? [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              logFormat
            )
          })
        ]
      : []),
    
    // In production, you might want to add file transports or external services
    // For now, we're keeping it simple with console-only logging
  ],
  // Prevent Winston from exiting on error
  exitOnError: false,
});

/**
 * Enhanced logger interface with sanitization
 */
export class Logger {
  private static sanitizeMessage(message: string, ...args: any[]): [string, any[]] {
    return [message, args.map(sanitizeData)];
  }

  static error(message: string, ...args: any[]): void {
    const [sanitizedMessage, sanitizedArgs] = this.sanitizeMessage(message, ...args);
    logger.error(sanitizedMessage, ...sanitizedArgs);
  }

  static warn(message: string, ...args: any[]): void {
    const [sanitizedMessage, sanitizedArgs] = this.sanitizeMessage(message, ...args);
    logger.warn(sanitizedMessage, ...sanitizedArgs);
  }

  static info(message: string, ...args: any[]): void {
    const [sanitizedMessage, sanitizedArgs] = this.sanitizeMessage(message, ...args);
    logger.info(sanitizedMessage, ...sanitizedArgs);
  }

  static debug(message: string, ...args: any[]): void {
    const [sanitizedMessage, sanitizedArgs] = this.sanitizeMessage(message, ...args);
    logger.debug(sanitizedMessage, ...sanitizedArgs);
  }

  /**
   * Log HTTP requests (common in API routes)
   */
  static http(method: string, url: string, statusCode?: number, duration?: number): void {
    const message = `${method} ${url}${statusCode ? ` - ${statusCode}` : ''}${duration ? ` (${duration}ms)` : ''}`;
    logger.info(message);
  }

  /**
   * Log database operations
   */
  static db(operation: string, table?: string, duration?: number): void {
    const message = `DB ${operation}${table ? ` on ${table}` : ''}${duration ? ` (${duration}ms)` : ''}`;
    logger.debug(message);
  }

  /**
   * Log queue operations
   */
  static queue(operation: string, jobType?: string, jobId?: string): void {
    const message = `Queue ${operation}${jobType ? ` ${jobType}` : ''}${jobId ? ` [${jobId}]` : ''}`;
    logger.info(message);
  }

  /**
   * Log email operations
   */
  static email(operation: string, recipient?: string, success?: boolean): void {
    const sanitizedRecipient = recipient ? sanitizeData(recipient) : '';
    const message = `Email ${operation}${sanitizedRecipient ? ` to ${sanitizedRecipient}` : ''}${success !== undefined ? ` - ${success ? 'SUCCESS' : 'FAILED'}` : ''}`;
    logger.info(message);
  }
}

// Export the Winston logger instance for advanced usage if needed
export { logger as winstonLogger };

// Export default logger
export default Logger;