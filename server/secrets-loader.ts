import { readFileSync, existsSync } from 'fs'

/**
 * Load Docker secrets at runtime
 * This is called from server initialization to ensure secrets are loaded
 * before any other code runs
 */
export function loadDockerSecrets(): void {
  // Only run on server-side
  if (typeof window !== 'undefined') {
    return
  }

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

  console.log('Loading Docker secrets...')
  let secretsLoaded = 0

  for (const { file, env } of secrets) {
    const secretPath = `/run/secrets/${file}`
    if (existsSync(secretPath)) {
      try {
        const secret = readFileSync(secretPath, 'utf8').trim()
        if (secret && !process.env[env]) {
          process.env[env] = secret
          secretsLoaded++
        }
      } catch (error) {
        console.warn(`Failed to read Docker secret ${file}`)
      }
    }
  }

  if (secretsLoaded > 0) {
    console.log(`✓ Loaded ${secretsLoaded} secrets from Docker`)
  }

  if (!process.env.DATABASE_URL && process.env.POSTGRES_PASSWORD) {
    const user = process.env.POSTGRES_USER || 'postgres'
    const password = process.env.POSTGRES_PASSWORD
    const host = process.env.POSTGRES_HOST || 'postgres'
    const port = process.env.POSTGRES_PORT || '5432'
    const db = process.env.POSTGRES_DB || 'gsthive'
    
    process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}`
    console.log('✓ DATABASE_URL constructed from secrets')
  }

  // Construct REDIS_URL if components are available
  if (!process.env.REDIS_URL && process.env.REDIS_PASSWORD) {
    const password = process.env.REDIS_PASSWORD
    const host = process.env.REDIS_HOST || 'redis'
    const port = process.env.REDIS_PORT || '6379'
    
    process.env.REDIS_URL = `redis://:${password}@${host}:${port}`
    console.log('✓ REDIS_URL constructed from secrets')
  }

  console.log('Docker secrets loading complete')
}

// Load secrets immediately when this module is imported
loadDockerSecrets()