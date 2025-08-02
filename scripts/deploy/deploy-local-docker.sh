#!/bin/bash
# Deploy GST Hive to local Docker with dev.gsthive.com

set -e

echo "🚀 Starting GST Hive local Docker deployment..."

# Change to project root
cd "$(dirname "$0")/../.."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file with necessary configuration"
    exit 1
fi

# Check if CLOUDFLARE_TUNNEL_TOKEN is set
if ! grep -q "CLOUDFLARE_TUNNEL_TOKEN=" .env || [ -z "$(grep CLOUDFLARE_TUNNEL_TOKEN= .env | cut -d'=' -f2)" ]; then
    echo "❌ Error: CLOUDFLARE_TUNNEL_TOKEN not set in .env file!"
    echo "This is required for dev.gsthive.com to work"
    exit 1
fi

# Export environment variables from .env file
export $(grep -v '^#' .env | xargs)

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker compose --env-file .env -f docker/docker-compose.local.yml down

# Build fresh images
echo "🔨 Building Docker images..."
docker compose --env-file .env -f docker/docker-compose.local.yml build --no-cache

# Start services
echo "🚀 Starting services..."
docker compose --env-file .env -f docker/docker-compose.local.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check if postgres is ready
echo "🔍 Checking PostgreSQL..."
docker compose --env-file .env -f docker/docker-compose.local.yml exec -T postgres pg_isready -U postgres

# Run database migrations
echo "🗄️ Running database migrations..."
docker compose --env-file .env -f docker/docker-compose.local.yml exec -T app npx prisma migrate deploy

# Check Redis connection
echo "🔍 Checking Redis..."
if [ -n "$(grep REDIS_PASSWORD= .env | cut -d'=' -f2)" ]; then
    docker compose --env-file .env -f docker/docker-compose.local.yml exec -T redis redis-cli -a "${REDIS_PASSWORD}" ping
else
    docker compose --env-file .env -f docker/docker-compose.local.yml exec -T redis redis-cli ping
fi

# Show container status
echo "📊 Container status:"
docker compose --env-file .env -f docker/docker-compose.local.yml ps

# Show logs for debugging
echo "📜 Recent logs:"
docker compose --env-file .env -f docker/docker-compose.local.yml logs --tail=20

# Check if services are running
if docker compose --env-file .env -f docker/docker-compose.local.yml ps | grep -q "Exit"; then
    echo "❌ Some services have exited. Check logs above."
    exit 1
fi

echo "✅ Deployment complete!"
echo "🌐 GST Hive should be accessible at: https://dev.gsthive.com"
echo ""
echo "📝 Useful commands:"
echo "  View logs: docker compose --env-file .env -f docker/docker-compose.local.yml logs -f"
echo "  Stop all: docker compose --env-file .env -f docker/docker-compose.local.yml down"
echo "  Restart: docker compose --env-file .env -f docker/docker-compose.local.yml restart"
echo "  Check queue worker: docker compose --env-file .env -f docker/docker-compose.local.yml logs -f queue-worker"