#!/bin/bash

# Simplified development setup with Cloudflare tunnel

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting GST Hive Development with Cloudflare Tunnel${NC}"
echo -e "${BLUE}   Access at: https://dev.gsthive.com${NC}"
echo ""

# Check .env.local
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local not found!${NC}"
    exit 1
fi

# Export tunnel token
export CLOUDFLARE_TUNNEL_TOKEN=$(grep CLOUDFLARE_TUNNEL_TOKEN .env.local | cut -d'"' -f2)

# Start infrastructure
echo -e "${YELLOW}🚀 Starting infrastructure...${NC}"
docker compose -f docker-compose.dev.yml up -d

# Wait for services
echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Check status
docker compose -f docker-compose.dev.yml ps

# Run migrations with npm
echo -e "${GREEN}🗄️  Running database migrations...${NC}"
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gsthive_dev?schema=public" npm run db:migrate

# Start Next.js dev server
echo -e "${GREEN}🚀 Starting Next.js development server...${NC}"
echo -e "${YELLOW}   This will run in the foreground. Press Ctrl+C to stop.${NC}"
echo ""

# Set environment variables for Next.js
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gsthive_dev?schema=public"
export REDIS_URL="redis://localhost:6379"
export NEXTAUTH_URL="https://dev.gsthive.com"
export $(grep -v '^#' .env.local | xargs)

# Start dev server
npm run dev