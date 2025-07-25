import { readFileSync, existsSync } from 'fs'

/**
 * Load a secret from Docker secrets or fallback to environment variable
 * @param secretName - Name of the secret (e.g., 'nextauth_secret')
 * @param envVarName - Name of the environment variable (e.g., 'NEXTAUTH_SECRET')
 * @returns The secret value or undefined
 */
export function loadSecret(secretName: string, envVarName: string): string | undefined {
  // First, try to read from Docker secret file
  const secretPath = `/run/secrets/${secretName}`
  if (existsSync(secretPath)) {
    try {
      const secret = readFileSync(secretPath, 'utf8').trim()
      if (secret) {
        return secret
      }
    } catch (error) {
      console.warn(`Failed to read Docker secret ${secretName}:`, error)
    }
  }

  // Fallback to environment variable
  return process.env[envVarName]
}

/**
 * Load all required secrets and set them as environment variables
 * This should be called once during application startup
 */
export function loadAllSecrets(): void {
  const secrets = [
    { file: 'postgres_password', env: 'POSTGRES_PASSWORD' },
    { file: 'redis_password', env: 'REDIS_PASSWORD' },
    { file: 'nextauth_secret', env: 'NEXTAUTH_SECRET' },
    { file: 'aws_ses_smtp_user', env: 'AWS_SES_SMTP_USER' },
    { file: 'aws_ses_smtp_password', env: 'AWS_SES_SMTP_PASSWORD' },
    { file: 'aws_ses_access_key_id', env: 'AWS_SES_ACCESS_KEY_ID' },
    { file: 'aws_ses_secret_access_key', env: 'AWS_SES_SECRET_ACCESS_KEY' },
    { file: 'aws_access_key_id', env: 'AWS_ACCESS_KEY_ID' },
    { file: 'aws_secret_access_key', env: 'AWS_SECRET_ACCESS_KEY' },
    { file: 'rbi_api_key', env: 'RBI_API_KEY' },
    { file: 'exchange_rate_api_key', env: 'EXCHANGE_RATE_API_KEY' },
    { file: 'cron_secret', env: 'CRON_SECRET' },
  ]

  for (const { file, env } of secrets) {
    const value = loadSecret(file, env)
    if (value && !process.env[env]) {
      process.env[env] = value
    }
  }

  // Construct DATABASE_URL if components are available
  if (!process.env.DATABASE_URL && process.env.POSTGRES_PASSWORD) {
    const user = process.env.POSTGRES_USER || 'postgres'
    const password = process.env.POSTGRES_PASSWORD
    const host = process.env.POSTGRES_HOST || 'postgres'
    const port = process.env.POSTGRES_PORT || '5432'
    const db = process.env.POSTGRES_DB || 'gsthive'
    
    process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}`
  }

  // Construct REDIS_URL if components are available
  if (!process.env.REDIS_URL && process.env.REDIS_PASSWORD) {
    const password = process.env.REDIS_PASSWORD
    const host = process.env.REDIS_HOST || 'redis'
    const port = process.env.REDIS_PORT || '6379'
    
    process.env.REDIS_URL = `redis://:${password}@${host}:${port}`
  }
}