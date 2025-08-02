#!/bin/bash

# Docker Build Script for GSTHive
set -e

echo "🐳 Building GSTHive Docker image..."

# Default values
IMAGE_NAME="${IMAGE_NAME:-gsthive}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Build the Docker image
echo "📦 Building Docker image: $IMAGE_NAME:$IMAGE_TAG"
docker build -t "$IMAGE_NAME:$IMAGE_TAG" .

# Tag for different registries if needed
if [ -n "$DOCKER_REGISTRY" ]; then
    echo "🏷️ Tagging for registry: $DOCKER_REGISTRY"
    docker tag "$IMAGE_NAME:$IMAGE_TAG" "$DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
fi

echo "✅ Docker build complete!"
echo ""
echo "To run locally with docker-compose:"
echo "  docker-compose up -d"
echo ""
echo "To push to a registry:"
echo "  docker push $DOCKER_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"