#!/bin/bash
# Start all development services with combined logs

# Colors for different services
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}[CLEANUP]${NC} Shutting down all services..."
    
    # Kill all background processes
    if [ -n "$NEXT_PID" ]; then
        kill $NEXT_PID 2>/dev/null
    fi
    if [ -n "$WORKER_PID" ]; then
        kill $WORKER_PID 2>/dev/null
    fi
    
    # Stop Redis container
    docker stop redis-local 2>/dev/null
    docker rm redis-local 2>/dev/null
    
    echo -e "${GREEN}[CLEANUP]${NC} All services stopped"
    exit 0
}

# Trap CTRL+C and other signals
trap cleanup SIGINT SIGTERM EXIT

echo -e "${PURPLE}========================================${NC}"
echo -e "${PURPLE}   Starting GSTHive Development Stack   ${NC}"
echo -e "${PURPLE}========================================${NC}\n"

# Check if Redis is already running
if docker ps | grep -q redis-local; then
    echo -e "${YELLOW}[REDIS]${NC} Redis container already running"
else
    echo -e "${BLUE}[REDIS]${NC} Starting Redis container..."
    docker run -d --name redis-local -p 6379:6379 redis:7-alpine > /dev/null 2>&1
    
    # Wait for Redis to be ready
    echo -e "${BLUE}[REDIS]${NC} Waiting for Redis to be ready..."
    sleep 2
    
    # Test Redis connection
    if docker exec redis-local redis-cli ping > /dev/null 2>&1; then
        echo -e "${GREEN}[REDIS]${NC} Redis is ready!"
    else
        echo -e "${RED}[REDIS]${NC} Failed to start Redis"
        exit 1
    fi
fi

echo -e "\n${BLUE}[ENV]${NC} Setting up environment..."
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=

# Create named pipes for service outputs
NEXT_PIPE=$(mktemp -u)
WORKER_PIPE=$(mktemp -u)
mkfifo "$NEXT_PIPE"
mkfifo "$WORKER_PIPE"

# Start Next.js dev server
echo -e "\n${BLUE}[NEXT]${NC} Starting Next.js development server..."
npm run dev 2>&1 | while IFS= read -r line; do
    echo -e "${GREEN}[NEXT]${NC} $line"
done < "$NEXT_PIPE" &
NEXT_PID=$!
exec 3> "$NEXT_PIPE"
npm run dev >&3 2>&1 &

# Wait a bit for Next.js to start
sleep 3

# Start Queue Worker
echo -e "\n${BLUE}[WORKER]${NC} Starting queue worker..."
npm run worker 2>&1 | while IFS= read -r line; do
    echo -e "${YELLOW}[WORKER]${NC} $line"
done < "$WORKER_PIPE" &
WORKER_PID=$!
exec 4> "$WORKER_PIPE"
npm run worker >&4 2>&1 &

echo -e "\n${PURPLE}========================================${NC}"
echo -e "${GREEN}✓ All services started successfully!${NC}"
echo -e "${PURPLE}========================================${NC}"
echo -e "\n${BLUE}Service URLs:${NC}"
echo -e "  ${GREEN}➜${NC} Application: http://localhost:3000"
echo -e "  ${GREEN}➜${NC} Database UI: Run 'npm run db:studio' in another terminal"
echo -e "\n${YELLOW}Press CTRL+C to stop all services${NC}\n"

# Wait for all background processes
wait