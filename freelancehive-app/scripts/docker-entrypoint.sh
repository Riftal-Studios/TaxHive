#!/bin/sh
set -e

# Wait for database to be ready
echo "Waiting for database..."
until nc -z postgres 5432; do
  echo "Database is unavailable - sleeping"
  sleep 2
done
echo "Database is ready!"

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Start the application based on the command
case "$1" in
  "app")
    echo "Starting Next.js application..."
    exec node server.js
    ;;
  "worker")
    echo "Starting queue worker..."
    exec npm run queue:worker
    ;;
  "cron")
    echo "Starting cron scheduler..."
    exec npm run cron:start
    ;;
  *)
    echo "Unknown command: $1"
    echo "Usage: $0 {app|worker|cron}"
    exit 1
    ;;
esac