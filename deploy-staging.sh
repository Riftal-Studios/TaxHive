#!/bin/bash

# Deploy local staging environment using act
# This mimics production deployment with staging configuration

set -e

echo "🚀 Starting local staging deployment with act..."

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "❌ Error: 'act' is not installed. Please install it first:"
    echo "   https://github.com/nektos/act#installation"
    exit 1
fi

# Check if required files exist
if [ ! -f ".secrets.staging" ]; then
    echo "❌ Error: .secrets.staging file not found"
    echo "Create it with your staging secrets"
    exit 1
fi

if [ ! -f ".vars.staging" ]; then
    echo "❌ Error: .vars.staging file not found"
    echo "Create it with your staging variables"
    exit 1
fi

# Run act with the deploy-local-staging workflow
act -W .github/workflows/deploy-local-staging.yml \
    --secret-file .secrets.staging \
    --var-file .vars.staging \
    -j deploy-local-staging

echo "✅ Staging deployment complete!"
echo "🌐 Access staging at: https://stage.gsthive.com"