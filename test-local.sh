#!/bin/bash

# Quick test script for local development

echo "🧪 Testing GST Hive Local Setup"
echo ""

# Check Docker
echo "1. Checking Docker..."
if docker info > /dev/null 2>&1; then
    echo "✅ Docker is running"
else
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Check .env.local
echo ""
echo "2. Checking .env.local..."
if [ -f .env.local ]; then
    echo "✅ .env.local exists"
    # Check for tunnel token
    if grep -q "CLOUDFLARE_TUNNEL_TOKEN=" .env.local; then
        echo "✅ Cloudflare tunnel token found"
    else
        echo "❌ Cloudflare tunnel token not found in .env.local"
    fi
else
    echo "❌ .env.local not found"
    exit 1
fi

# Quick start services
echo ""
echo "3. Starting minimal services..."
docker compose -f docker-compose.local.yml --env-file .env.local up -d postgres redis

# Wait a bit
echo "⏳ Waiting for services..."
sleep 5

# Check services
echo ""
echo "4. Service Status:"
docker compose -f docker-compose.local.yml --env-file .env.local ps

echo ""
echo "✨ Test complete!"
echo ""
echo "To start full stack:"
echo "docker compose -f docker-compose.local.yml --env-file .env.local up -d"
echo ""
echo "To view logs:"
echo "docker compose -f docker-compose.local.yml --env-file .env.local logs -f"