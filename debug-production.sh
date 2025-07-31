#!/bin/bash

# Debug script for production issues
# Run this on the production server to diagnose Cloudflare tunnel issues

echo "=== Production Debug Script ==="
echo "Date: $(date)"
echo ""

echo "1. Checking running containers:"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}"
echo ""

echo "1b. Checking container restart counts:"
for container in gsthive-app gsthive-tunnel gsthive-postgres gsthive-redis; do
  RESTARTS=$(docker inspect $container --format='{{.RestartCount}}' 2>/dev/null)
  if [ $? -eq 0 ]; then
    echo "$container: $RESTARTS restarts"
  fi
done
echo ""

echo "2. Checking container health:"
docker inspect gsthive-app --format='{{.State.Health.Status}}' 2>/dev/null || echo "App container not found"
docker inspect gsthive-postgres --format='{{.State.Health.Status}}' 2>/dev/null || echo "Postgres container not found"
docker inspect gsthive-redis --format='{{.State.Health.Status}}' 2>/dev/null || echo "Redis container not found"
echo ""

echo "3. Checking network connectivity:"
echo "Networks:"
docker network ls | grep gsthive
echo ""

echo "4. Testing internal connectivity from tunnel to app:"
docker exec gsthive-tunnel wget -qO- http://app:3000/api/health 2>&1 || echo "Failed to connect from tunnel to app"
echo ""

echo "5. Checking app logs (last 20 lines):"
docker logs gsthive-app --tail 20 2>&1
echo ""

echo "6. Checking tunnel logs (last 20 lines):"
docker logs gsthive-tunnel --tail 20 2>&1
echo ""

echo "7. Checking if app is listening on port 3000:"
docker exec gsthive-app netstat -tlnp | grep 3000 || echo "App might not be listening on port 3000"
echo ""

echo "8. Environment check:"
docker exec gsthive-app printenv | grep -E "NEXTAUTH_URL|NODE_ENV|DATABASE_URL" | sed 's/PASSWORD=.*/PASSWORD=***/'
echo ""

echo "=== End of debug output ==="