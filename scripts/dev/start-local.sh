#!/bin/bash

echo "🚀 Starting TaxHive locally..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✅ Created .env file. Please update it with your settings.${NC}"
    else
        echo -e "${RED}❌ No .env.example file found. Please create .env manually.${NC}"
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
fi

# Check if using SQLite (simpler for local dev)
if grep -q "file:.*\.db" .env; then
    echo -e "${GREEN}✅ Using SQLite database${NC}"
    
    # Generate Prisma Client
    echo "🔧 Generating Prisma Client..."
    npm run generate
    
    # Push schema to database
    echo "📊 Setting up database..."
    npm run db:push
    
else
    # Using PostgreSQL
    echo "🐘 Using PostgreSQL database"
    
    # Check if PostgreSQL is running
    if ! command -v pg_isready &> /dev/null; then
        echo -e "${YELLOW}⚠️  pg_isready command not found. Skipping PostgreSQL check.${NC}"
    else
        if ! pg_isready -q; then
            echo -e "${RED}❌ PostgreSQL is not running. Please start it first.${NC}"
            echo "   macOS: brew services start postgresql"
            echo "   Linux: sudo systemctl start postgresql"
            exit 1
        fi
        echo -e "${GREEN}✅ PostgreSQL is running${NC}"
    fi
    
    # Generate Prisma Client
    echo "🔧 Generating Prisma Client..."
    npm run generate
    
    # Run migrations
    echo "📊 Running database migrations..."
    npm run db:migrate
fi

# Optional: Seed database
read -p "Do you want to seed the database with sample data? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌱 Seeding database..."
    npm run db:seed
fi

# Start the development server
echo -e "${GREEN}🌟 Starting development server...${NC}"
echo -e "${GREEN}🌐 Open http://localhost:3000 in your browser${NC}"
echo -e "${YELLOW}📧 If email is not configured, check console for magic links${NC}"
echo ""

npm run dev