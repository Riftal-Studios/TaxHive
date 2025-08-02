#!/bin/bash

# GSTHive Deployment Script
set -e

echo "🚀 Starting GSTHive deployment..."

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found. Please install it first:"
    echo "curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if logged in to Fly.io
if ! fly auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io. Please run: fly auth login"
    exit 1
fi

# Build and deploy
echo "📦 Building Docker image..."
fly deploy --config fly.toml

# Run database migrations
echo "🗄️ Running database migrations..."
fly ssh console -C "npx prisma migrate deploy"

# Verify deployment
echo "✅ Verifying deployment..."
APP_URL=$(fly info --json | jq -r '.App.Hostname')
curl -s "https://$APP_URL/api/health" | jq .

echo "🎉 Deployment complete! Your app is live at: https://$APP_URL"