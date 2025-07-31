#!/bin/bash

# Script to validate Cloudflare tunnel token and configuration

echo "=== Cloudflare Tunnel Token Validation ==="
echo ""

# Check if token is set
if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    echo "❌ CLOUDFLARE_TUNNEL_TOKEN is not set"
    echo "Please export CLOUDFLARE_TUNNEL_TOKEN='your-token-here'"
    exit 1
fi

echo "✅ Token is set (length: ${#CLOUDFLARE_TUNNEL_TOKEN} characters)"

# Decode the token to check its structure (it's a base64 encoded JSON)
echo ""
echo "Decoding token structure..."
TOKEN_PAYLOAD=$(echo "$CLOUDFLARE_TUNNEL_TOKEN" | base64 -d 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Token is valid base64"
    # Extract tunnel ID from the decoded JSON
    TUNNEL_ID=$(echo "$TOKEN_PAYLOAD" | grep -o '"t":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$TUNNEL_ID" ]; then
        echo "✅ Tunnel ID: $TUNNEL_ID"
    else
        echo "⚠️  Could not extract tunnel ID from token"
    fi
else
    echo "❌ Token is not valid base64 - might be corrupted"
fi

echo ""
echo "To test the tunnel locally:"
echo "1. Export the token: export CLOUDFLARE_TUNNEL_TOKEN='your-token'"
echo "2. Run: docker run --rm -e TUNNEL_TOKEN=\$CLOUDFLARE_TUNNEL_TOKEN cloudflare/cloudflared:latest tunnel --no-autoupdate run"
echo ""
echo "If the tunnel starts successfully locally but fails in production, check:"
echo "- GitHub secret is set correctly (no extra spaces/newlines)"
echo "- Tunnel configuration in Cloudflare dashboard matches your setup"
echo "- The tunnel hasn't been deleted/recreated in Cloudflare"