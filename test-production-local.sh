#!/bin/bash

# Test production setup locally
set -e

echo "🚀 Testing production setup locally..."

# Export all variables
set -a
source .secrets.production-test
set +a

# Create a test network
docker network create gsthive-test 2>/dev/null || true

# Start a simple web server to simulate the app
echo "Starting test web server..."
docker run -d --rm \
  --name test-app \
  --network gsthive-test \
  -p 3000:80 \
  nginx:alpine

# Wait for nginx to start
sleep 2

# Test if the web server is accessible
echo "Testing web server..."
docker run --rm --network gsthive-test alpine wget -qO- http://test-app:80 || echo "Failed to reach test app"

# Now start the tunnel pointing to the test app
echo "Starting tunnel..."
docker run --rm \
  --name test-tunnel \
  --network gsthive-test \
  -e TUNNEL_INGRESS_URL=http://test-app:80 \
  cloudflare/cloudflared:latest \
  tunnel --no-autoupdate run --token $CLOUDFLARE_TUNNEL_TOKEN

# Cleanup
docker stop test-app 2>/dev/null || true
docker network rm gsthive-test 2>/dev/null || true