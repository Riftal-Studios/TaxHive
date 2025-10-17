#!/bin/bash

echo "🔍 Checking Cloudflare tunnel status..."

# Check if cloudflared container is running
if docker ps | grep -q taxhive-tunnel; then
    echo "✅ Cloudflared container is running"
    
    # Get container logs
    echo -e "\n📋 Last 50 lines of tunnel logs:"
    docker logs taxhive-tunnel --tail 50
    
    # Check container health
    echo -e "\n🏥 Container details:"
    docker inspect taxhive-tunnel | grep -A 5 "State"
else
    echo "❌ Cloudflared container is NOT running"
    
    # Check if it exists but stopped
    if docker ps -a | grep -q taxhive-tunnel; then
        echo "⚠️  Container exists but is stopped"
        echo -e "\n📋 Last 50 lines of logs:"
        docker logs taxhive-tunnel --tail 50
    fi
fi

# Check environment variable
echo -e "\n🔑 Checking CLOUDFLARE_TUNNEL_TOKEN:"
if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "❌ CLOUDFLARE_TUNNEL_TOKEN is not set"
else
    echo "✅ CLOUDFLARE_TUNNEL_TOKEN is set (length: ${#CLOUDFLARE_TUNNEL_TOKEN})"
fi

# Try to restart the tunnel
echo -e "\n🔄 Attempting to restart tunnel..."
docker-compose restart cloudflared

sleep 5

echo -e "\n📋 New tunnel logs:"
docker logs taxhive-tunnel --tail 20