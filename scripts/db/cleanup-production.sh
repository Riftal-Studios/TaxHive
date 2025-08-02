#!/bin/bash
# Clean up temporary fixes from production

echo "Cleaning up temporary production fixes..."

# Remove hardcoded NEXTAUTH_SECRET from docker-compose.yml
if grep -q "NEXTAUTH_SECRET:" docker-compose.yml | grep -v '${NEXTAUTH_SECRET}'; then
    echo "Found hardcoded NEXTAUTH_SECRET - please remove manually"
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
echo "NOTE: Please manually check docker-compose.yml for any hardcoded secrets"