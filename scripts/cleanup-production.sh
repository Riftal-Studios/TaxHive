#!/bin/bash
# Clean up temporary fixes from production

echo "Cleaning up temporary production fixes..."

# Remove hardcoded NEXTAUTH_SECRET from docker-compose.yml
if grep -q "NEXTAUTH_SECRET: ***REMOVED***" docker-compose.yml; then
    echo "Removing hardcoded NEXTAUTH_SECRET..."
    sed -i '/NEXTAUTH_SECRET: ***REMOVED***/d' docker-compose.yml
fi

# Remove hardcoded Cloudflare token if present
if grep -q '***REMOVED***' docker-compose.yml; then
    echo "Removing hardcoded Cloudflare token..."
    sed -i 's|"tunnel", "--no-autoupdate", "run", "--token", "***REMOVED***"|"tunnel", "--no-autoupdate", "run"|' docker-compose.yml
fi

# Remove any .env files that shouldn't be there
if [ -f ".env" ]; then
    echo "Removing .env file (using Docker secrets instead)..."
    rm -f .env
fi

if [ -f ".env.tunnel" ]; then
    echo "Removing .env.tunnel file..."
    rm -f .env.tunnel
fi

# Remove temporary scripts
rm -f load-secrets.js docker-entrypoint.sh tunnel-entrypoint.sh

echo "✓ Cleanup completed"