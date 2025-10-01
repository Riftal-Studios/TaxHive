#!/bin/bash
# Fix failed migrations in Docker PostgreSQL

set -e

echo "🔧 Fixing failed migrations in Docker PostgreSQL..."

# Change to project root
cd "$(dirname "$0")/.."

# Export environment variables
export $(grep -v '^#' .env | xargs)

# Check if containers are running
if ! docker compose --env-file .env -f docker/docker-compose.local.yml ps | grep -q "gsthive-dev-postgres"; then
    echo "❌ PostgreSQL container is not running. Starting it..."
    docker compose --env-file .env -f docker/docker-compose.local.yml up -d postgres
    sleep 5
fi

echo "📋 Current migration status:"
docker compose --env-file .env -f docker/docker-compose.local.yml exec -T app npx prisma migrate status || true

echo ""
echo "🔄 Option 1: Reset and reapply all migrations (RECOMMENDED)"
echo "⚠️  This will:"
echo "   - Mark the failed migration as rolled back"
echo "   - Push the current schema to the database"
echo "   - Mark all migrations as applied"
echo ""
echo "🔄 Option 2: Force reset database (DESTRUCTIVE)"
echo "⚠️  This will:"
echo "   - Drop all tables and data"
echo "   - Recreate from scratch"
echo ""

read -p "Choose option (1 or 2): " option

if [ "$option" = "1" ]; then
    echo "🔧 Fixing migrations (non-destructive)..."
    
    # First, mark the failed migration as rolled back
    echo "📝 Marking failed migration as rolled back..."
    docker compose --env-file .env -f docker/docker-compose.local.yml exec -T postgres psql -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-gsthive_dev} -c "
        UPDATE _prisma_migrations 
        SET finished_at = NOW(), 
            rolled_back_at = NOW() 
        WHERE migration_name = '20250821102754_add_rcm_phase3_and_self_invoice' 
        AND finished_at IS NULL;
    "
    
    # Push current schema to database
    echo "🔄 Pushing current schema to database..."
    docker compose --env-file .env -f docker/docker-compose.local.yml exec -T app npx prisma db push --skip-generate --accept-data-loss
    
    # Mark all migrations as applied
    echo "✅ Marking all migrations as applied..."
    for migration in $(ls prisma/migrations | grep -E '^[0-9]+'); do
        echo "  - Marking $migration as applied"
        docker compose --env-file .env -f docker/docker-compose.local.yml exec -T app npx prisma migrate resolve --applied "$migration" 2>/dev/null || true
    done
    
elif [ "$option" = "2" ]; then
    echo "⚠️  WARNING: This will DELETE ALL DATA!"
    read -p "Are you sure? Type 'yes' to continue: " confirm
    
    if [ "$confirm" = "yes" ]; then
        echo "🗑️  Resetting database..."
        
        # Drop and recreate database
        docker compose --env-file .env -f docker/docker-compose.local.yml exec -T postgres psql -U ${POSTGRES_USER:-postgres} -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-gsthive_dev};"
        docker compose --env-file .env -f docker/docker-compose.local.yml exec -T postgres psql -U ${POSTGRES_USER:-postgres} -c "CREATE DATABASE ${POSTGRES_DB:-gsthive_dev};"
        
        # Run migrations from scratch
        echo "🔄 Running migrations from scratch..."
        docker compose --env-file .env -f docker/docker-compose.local.yml exec -T app npx prisma migrate deploy
    else
        echo "❌ Cancelled"
        exit 1
    fi
else
    echo "❌ Invalid option"
    exit 1
fi

# Check final status
echo ""
echo "📋 Final migration status:"
docker compose --env-file .env -f docker/docker-compose.local.yml exec -T app npx prisma migrate status

echo ""
echo "✅ Migration fix complete!"
echo ""
echo "🔄 Now restart your services:"
echo "   ./scripts/deploy/deploy-local-docker.sh"