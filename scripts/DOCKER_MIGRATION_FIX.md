# Docker Migration Fix Guide

## Problem
You're encountering the error:
```
Error: P3009
migrate found failed migrations in the target database
The `20250821102754_add_rcm_phase3_and_self_invoice` migration failed
```

This happens when a migration fails to apply in the Docker PostgreSQL container, blocking all future migrations.

## Quick Fix (Recommended)

Run the automatic fix script:
```bash
./scripts/fix-docker-migrations-auto.sh
```

This will:
1. Mark failed migrations as rolled back
2. Sync the current schema with the database
3. Mark all migrations as applied
4. Restart your services

## Alternative Solutions

### Option 1: Use the Updated Deployment Script
The deployment script now automatically handles failed migrations:
```bash
./scripts/deploy/deploy-local-docker.sh
```

### Option 2: Interactive Fix
For more control, use the interactive script:
```bash
./scripts/fix-docker-migrations.sh
```
Choose option 1 for non-destructive fix or option 2 to reset the database completely.

### Option 3: Manual Fix
If you prefer manual control:

```bash
# 1. Connect to the PostgreSQL container
docker compose --env-file .env -f docker/docker-compose.local.yml exec postgres psql -U postgres -d gsthive_dev

# 2. Fix the failed migration
UPDATE _prisma_migrations 
SET finished_at = NOW() 
WHERE migration_name = '20250821102754_add_rcm_phase3_and_self_invoice' 
AND finished_at IS NULL;

# 3. Exit psql
\q

# 4. Sync the schema
docker compose --env-file .env -f docker/docker-compose.local.yml exec app npx prisma db push --skip-generate

# 5. Mark migrations as applied
docker compose --env-file .env -f docker/docker-compose.local.yml exec app npx prisma migrate resolve --applied "20250821102754_add_rcm_phase3_and_self_invoice"
docker compose --env-file .env -f docker/docker-compose.local.yml exec app npx prisma migrate resolve --applied "20250121_add_itc_management"

# 6. Restart services
./scripts/deploy/deploy-local-docker.sh
```

## Prevention

The deployment script has been updated to automatically handle failed migrations in the future. Just use:
```bash
./scripts/deploy/deploy-local-docker.sh
```

## Verification

After fixing, verify the migration status:
```bash
docker compose --env-file .env -f docker/docker-compose.local.yml exec app npx prisma migrate status
```

You should see:
```
Database schema is up to date!
```

## Still Having Issues?

1. Check container logs:
```bash
docker compose --env-file .env -f docker/docker-compose.local.yml logs postgres
```

2. Reset everything (WARNING: Deletes all data):
```bash
docker compose --env-file .env -f docker/docker-compose.local.yml down -v
./scripts/deploy/deploy-local-docker.sh
```

3. Check if PostgreSQL is accessible:
```bash
docker compose --env-file .env -f docker/docker-compose.local.yml exec postgres pg_isready -U postgres
```