#!/bin/bash

# Test production tunnel locally
set -e

echo "🚀 Testing production tunnel locally..."

# Export all variables
set -a
source .secrets.production-test
set +a

# Stop any existing containers
echo "Stopping existing containers..."
docker compose -f docker/docker-compose.production.yml down || true

# Start just the tunnel to test it
echo "Starting tunnel in isolation..."
docker run --rm \
  --name test-tunnel \
  --network host \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run --token $CLOUDFLARE_TUNNEL_TOKEN