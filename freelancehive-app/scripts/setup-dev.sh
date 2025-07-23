#!/bin/bash

echo "🚀 Setting up GSTHive development environment..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop."
    exit 1
fi

echo "📦 Starting PostgreSQL and Redis..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate dev

# Generate Prisma client
echo "📝 Generating Prisma client..."
npx prisma generate

# Seed the database (if seed file exists)
if [ -f "prisma/seed.ts" ]; then
    echo "🌱 Seeding database..."
    npm run db:seed
fi

echo "✅ Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Run 'npm run dev' to start the development server"
echo "2. Visit http://localhost:3000"
echo ""
echo "🛠️  Useful commands:"
echo "- npm run db:studio    # Open Prisma Studio"
echo "- npm run test         # Run tests"
echo "- npm run lint         # Run linter"
echo "- docker-compose down  # Stop databases"