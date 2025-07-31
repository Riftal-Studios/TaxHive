#!/bin/bash

# Start all GSTHive services

echo "Starting GSTHive services..."

# Check if Redis is installed
if ! command -v redis-server &> /dev/null
then
    echo "Redis is not installed. Please install Redis first."
    echo "On macOS: brew install redis"
    echo "On Ubuntu: sudo apt-get install redis-server"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Dependencies not installed. Running npm install..."
    npm install
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo ".env.local not found. Creating from .env.example..."
    cp .env.example .env.local
    echo "Please edit .env.local with your configuration before running again."
    exit 1
fi

# Start Redis in background
echo "Starting Redis..."
redis-server --daemonize yes

# Wait for Redis to start
sleep 2

# Run database migrations
echo "Running database migrations..."
npx prisma migrate dev

# Start the queue worker in background
echo "Starting queue worker..."
npm run worker &
QUEUE_PID=$!

# Start the Next.js dev server
echo "Starting Next.js development server..."
echo ""
echo "GSTHive is starting at http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Trap Ctrl+C and cleanup
trap cleanup INT

cleanup() {
    echo ""
    echo "Shutting down services..."
    kill $QUEUE_PID 2>/dev/null
    redis-cli shutdown
    exit 0
}

# Start Next.js (this will block)
npm run dev