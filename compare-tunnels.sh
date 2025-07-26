#!/bin/bash

echo "=== Comparing Tunnel Tokens ==="
echo ""

# Production token you provided
PROD_TOKEN="eyJhIjoiZWNhM2U0YjQ0MzQ3OTkwYmY4OTg1NTA4YTdlMzI5YjUiLCJ0IjoiZGQ5NDAwNDAtMGM4MS00OTU1LWE3ZGItNmVjMDg3ZWM1YWUyIiwicyI6Ik1qVTNaV1E0WW1JdE5ESTVZeTAwWVRWaExUa3labVV0TVRWa1pUUXhNV1kxWm1ZeCJ9"

# Staging token from .secrets.staging
STAGING_TOKEN="eyJhIjoiZWNhM2U0YjQ0MzQ3OTkwYmY4OTg1NTA4YTdlMzI5YjUiLCJ0IjoiMDJmOGRkODctNjc2NC00ZDEwLTlkYmUtYTk2ZDFmYzI4ZjQ5IiwicyI6Ik5HTTJOelZtTmpVdE56STNZeTAwTkdZeUxUaG1aREl0TlRjek4ySTBaVEUxWWpRdyJ9"

echo "Production Token Analysis:"
echo "Token: ${PROD_TOKEN:0:20}..."
PROD_DECODED=$(echo "$PROD_TOKEN" | base64 -d 2>/dev/null)
if [ $? -eq 0 ]; then
    PROD_TUNNEL_ID=$(echo "$PROD_DECODED" | grep -o '"t":"[^"]*"' | cut -d'"' -f4)
    echo "Tunnel ID: $PROD_TUNNEL_ID"
    echo "Full decoded: $PROD_DECODED"
fi

echo ""
echo "Staging Token Analysis:"
echo "Token: ${STAGING_TOKEN:0:20}..."
STAGING_DECODED=$(echo "$STAGING_TOKEN" | base64 -d 2>/dev/null)
if [ $? -eq 0 ]; then
    STAGING_TUNNEL_ID=$(echo "$STAGING_DECODED" | grep -o '"t":"[^"]*"' | cut -d'"' -f4)
    echo "Tunnel ID: $STAGING_TUNNEL_ID"
    echo "Full decoded: $STAGING_DECODED"
fi

echo ""
echo "From production logs, tunnel is trying to connect as: b73b46b8-4214-4a45-858a-26b5b53f5b0d"
echo ""
echo "⚠️  The production token tunnel ID (dd940040-0c81-4955-a7db-6ec087ec5ae2) does NOT match"
echo "    the tunnel ID in the logs (b73b46b8-4214-4a45-858a-26b5b53f5b0d)"
echo ""
echo "This means either:"
echo "1. The GitHub secret CLOUDFLARE_TUNNEL_TOKEN is different from what was provided"
echo "2. The tunnel was recreated in Cloudflare and needs a new token"
echo "3. There's a configuration issue causing the wrong tunnel ID to be used"