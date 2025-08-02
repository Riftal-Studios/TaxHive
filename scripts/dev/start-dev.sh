#!/bin/bash

# Check and stop existing Redis container if running
if docker ps -a | grep -q redis-local; then
    echo "Stopping existing Redis container..."
    docker stop redis-local >/dev/null 2>&1
    docker rm redis-local >/dev/null 2>&1
fi

# Export environment variables for local development
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=""

# Run all services with concurrently
echo "Starting all development services..."
echo "=================================="
echo "📍 Application: http://localhost:3000"
echo "📍 Database UI: Run 'npm run db:studio' in another terminal"
echo "📍 Press CTRL+C to stop all services"
echo "=================================="
echo ""

# Use exec to replace the shell process with concurrently
# This ensures signals are properly forwarded
exec npx concurrently \
    --names "REDIS,NEXT,WORKER" \
    --prefix "[{name}]" \
    --prefix-colors "red,green,yellow" \
    --kill-others \
    --kill-others-on-fail \
    "docker run --rm --name redis-local -p 6379:6379 redis:7-alpine" \
    "npm run dev" \
    "npm run worker"