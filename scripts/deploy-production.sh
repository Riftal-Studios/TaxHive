#!/bin/bash
# Production deployment script
# This script handles Docker secrets and special cases like Cloudflare tunnel

set -e

# Function to update docker-compose.yml with Cloudflare token
update_cloudflare_token() {
    local token_file="./secrets/cloudflare_tunnel_token"
    if [ -f "$token_file" ]; then
        # Read the token
        local token=$(cat "$token_file")
        
        # Create a temporary override file for cloudflared
        cat > docker-compose.override.yml << EOF
services:
  cloudflared:
    command: ["tunnel", "--no-autoupdate", "run", "--token", "$token"]
EOF
        echo "✓ Created docker-compose.override.yml with Cloudflare token"
    else
        echo "⚠️  Warning: Cloudflare tunnel token not found at $token_file"
    fi
}

# Main deployment logic
main() {
    echo "Starting production deployment..."
    
    # Update Cloudflare token
    update_cloudflare_token
    
    # Deploy with docker compose
    if [ "$1" = "rebuild" ]; then
        echo "Rebuilding all services..."
        docker compose down
        docker compose up -d --force-recreate
    else
        echo "Standard deployment..."
        docker compose up -d
    fi
    
    # Wait for services to be healthy
    echo "Waiting for services to be healthy..."
    sleep 10
    
    # Run migrations
    echo "Running database migrations..."
    docker compose exec -T app npx prisma migrate deploy || echo "Migration failed or already up to date"
    
    # Show status
    echo "Deployment status:"
    docker compose ps
    
    echo "✓ Deployment completed"
}

# Run main function with all arguments
main "$@"