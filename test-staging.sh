#!/bin/bash

# Test staging deployment without act

set -e

echo "🚀 Starting direct staging deployment..."

# Export all variables from files
set -a
source .secrets.staging
source .vars.staging
set +a

# Stop existing containers
echo "Stopping existing containers..."
docker compose -f docker/docker-compose.staging.yml down

# Build and start all services
echo "Building and starting services..."
docker compose -f docker/docker-compose.staging.yml up -d --build

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 30

# Check container status
echo "Checking container status..."
docker compose -f docker/docker-compose.staging.yml ps

# Run migrations
echo "Running database migrations..."
docker compose -f docker/docker-compose.staging.yml exec -T app npx prisma migrate deploy

# Check logs
echo "Checking service logs..."
docker compose -f docker/docker-compose.staging.yml logs --tail 20

echo "✅ Staging deployment complete!"
echo "🌐 Access staging at: https://stage.gsthive.com"