#!/bin/sh
# Load secrets and start the Next.js server

# Load .env file if it exists
if [ -f .env ]; then
  echo "Loading environment variables from .env..."
  export $(grep -v '^#' .env | xargs)
fi

# Load Docker secrets
echo "Loading Docker secrets..."

# Function to load a secret
load_secret() {
  secret_file="/run/secrets/$1"
  if [ -f "$secret_file" ]; then
    secret_value=$(cat "$secret_file" | tr -d '\n')
    if [ -n "$secret_value" ]; then
      export "$2=$secret_value"
      echo "✓ Loaded $2 from Docker secret"
    fi
  fi
}

# Load all secrets
load_secret "postgres_password" "POSTGRES_PASSWORD"
load_secret "redis_password" "REDIS_PASSWORD"
load_secret "nextauth_secret" "NEXTAUTH_SECRET"
load_secret "aws_ses_smtp_user" "AWS_SES_SMTP_USER"
load_secret "aws_ses_smtp_password" "AWS_SES_SMTP_PASSWORD"
load_secret "exchange_rate_api_key" "EXCHANGE_RATE_API_KEY"
load_secret "cron_secret" "CRON_SECRET"

# Construct DATABASE_URL if needed
if [ -z "$DATABASE_URL" ] && [ -n "$POSTGRES_PASSWORD" ]; then
  POSTGRES_USER=${POSTGRES_USER:-postgres}
  POSTGRES_HOST=${POSTGRES_HOST:-postgres}
  POSTGRES_PORT=${POSTGRES_PORT:-5432}
  POSTGRES_DB=${POSTGRES_DB:-gsthive}
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
  echo "✓ DATABASE_URL constructed from Docker secrets"
fi

# Construct REDIS_URL if needed
if [ -z "$REDIS_URL" ] && [ -n "$REDIS_PASSWORD" ]; then
  REDIS_HOST=${REDIS_HOST:-redis}
  REDIS_PORT=${REDIS_PORT:-6379}
  export REDIS_URL="redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}"
  echo "✓ REDIS_URL constructed from Docker secrets"
fi

echo "Docker secrets loading complete"

# Debug: Show critical environment variables
echo "Environment check:"
echo "  NEXTAUTH_URL: ${NEXTAUTH_URL}"
echo "  NODE_ENV: ${NODE_ENV}"
echo "  DATABASE_URL: ${DATABASE_URL:0:30}..." # Show only first 30 chars for security

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js