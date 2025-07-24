#!/bin/bash

# Script to fix failed migrations in Supabase
# This should be run once to clean up the current failed state

echo "🔧 Fixing Supabase migrations..."

# Check if environment variables are set
if [ -z "$DATABASE_DB_URL" ] || [ -z "$DATABASE_DIRECT_URL" ]; then
    echo "❌ Missing required environment variables: DATABASE_DB_URL and DATABASE_DIRECT_URL"
    echo "Please set them before running this script:"
    echo "export DATABASE_DB_URL='your-supabase-pooler-url'"
    echo "export DATABASE_DIRECT_URL='your-supabase-direct-url'"
    exit 1
fi

echo "📊 Current migration status:"
npx prisma migrate status || true

echo -e "\n🔄 Resolving failed migration..."
npx prisma migrate resolve --rolled-back 20250716172554_init

echo -e "\n📊 Updated migration status:"
npx prisma migrate status

echo -e "\n🚀 Applying new migrations..."
npx prisma migrate deploy

echo -e "\n✅ Migrations fixed and applied successfully!"