#!/bin/sh
# Start the Next.js server

# Debug: Show critical environment variables
echo "Environment check:"
echo "  NEXTAUTH_URL: ${NEXTAUTH_URL}"
echo "  NODE_ENV: ${NODE_ENV}"
echo "  DATABASE_URL: ${DATABASE_URL:0:30}..." # Show only first 30 chars for security

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js