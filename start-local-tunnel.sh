#!/bin/bash

# GST Hive Local Development with Cloudflare Tunnel
# This script starts the local development environment with dev.gsthive.com

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting GST Hive Local Development Environment${NC}"
echo -e "${BLUE}   Access via: https://dev.gsthive.com${NC}"
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local not found!${NC}"
    echo "Please create .env.local with your configuration"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running!${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

# Stop any running containers
echo -e "${YELLOW}🛑 Stopping any existing containers...${NC}"
docker compose -f docker-compose.local.yml --env-file .env.local down

# Build the development image
echo -e "${YELLOW}🔨 Building development image...${NC}"
docker compose -f docker-compose.local.yml --env-file .env.local build

# Start all services
echo -e "${GREEN}🚀 Starting services...${NC}"
docker compose -f docker-compose.local.yml --env-file .env.local up -d

# Wait for services to be ready
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 15

# Run database migrations
echo -e "${GREEN}🗄️  Running database migrations...${NC}"
docker compose -f docker-compose.local.yml --env-file .env.local exec app npx prisma migrate dev --skip-seed

# Show status
echo -e "${GREEN}✅ All services started!${NC}"
docker compose -f docker-compose.local.yml --env-file .env.local ps

echo ""
echo -e "${BLUE}📌 Access your local GST Hive at:${NC}"
echo -e "${GREEN}   https://dev.gsthive.com${NC}"
echo ""
echo -e "${YELLOW}📋 Useful commands:${NC}"
echo "   View logs:        docker compose -f docker-compose.local.yml --env-file .env.local logs -f"
echo "   Stop services:    docker compose -f docker-compose.local.yml --env-file .env.local down"
echo "   Restart app:      docker compose -f docker-compose.local.yml --env-file .env.local restart app"
echo "   Run tests:        docker compose -f docker-compose.local.yml --env-file .env.local exec app npm test"
echo ""
echo -e "${YELLOW}⚠️  Note: Emails will appear in the console logs (EMAIL_PROVIDER=console)${NC}"