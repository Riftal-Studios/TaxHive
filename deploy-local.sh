#!/bin/bash

# Deploy local development environment using act
# This mimics GitHub Actions deployment locally

set -e

echo "🚀 Starting local deployment with act..."

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "❌ Error: 'act' is not installed. Please install it first:"
    echo "   https://github.com/nektos/act#installation"
    exit 1
fi

# Check if required files exist
if [ ! -f ".secrets" ]; then
    echo "❌ Error: .secrets file not found"
    echo "Create it with your development secrets"
    exit 1
fi

if [ ! -f ".vars" ]; then
    echo "❌ Error: .vars file not found"
    echo "Create it with your development variables"
    exit 1
fi

# Run act with the deploy-local workflow
act -W .github/workflows/deploy-local.yml \
    --secret-file .secrets \
    --var-file .vars \
    -j deploy-local

echo "✅ Deployment complete!"