# Local Development with Cloudflare Tunnel

This guide explains how to run GST Hive locally with a Cloudflare tunnel, allowing you to access your local development environment via `https://dev.gsthive.com`.

## Why Use Cloudflare Tunnel for Local Development?

- **HTTPS in development** - Test with real SSL certificates
- **Consistent URLs** - Use dev.gsthive.com instead of localhost
- **Team collaboration** - Share your local dev environment
- **Webhook testing** - Receive webhooks from external services
- **Production-like** - Closer to production environment

## Prerequisites

- Docker Desktop installed and running
- Cloudflare tunnel configured for dev.gsthive.com
- Tunnel token (provided)

## Quick Start

```bash
# 1. Start everything with one command
./start-local-tunnel.sh

# 2. Access your local GST Hive at:
https://dev.gsthive.com
```

That's it! The script handles everything.

## What the Script Does

1. **Checks prerequisites** - Docker running, .env.local exists
2. **Stops existing containers** - Clean slate
3. **Builds development image** - With hot reload support
4. **Starts all services**:
   - PostgreSQL database
   - Redis cache
   - Next.js app (with hot reload)
   - Cloudflare tunnel
   - Queue worker
5. **Runs migrations** - Sets up database schema
6. **Shows status** - Confirms everything is running

## Manual Setup (if needed)

```bash
# Start services
docker-compose -f docker-compose.local.yml up -d

# Run migrations
docker-compose -f docker-compose.local.yml exec app npx prisma migrate dev

# View logs
docker-compose -f docker-compose.local.yml logs -f
```

## Development Workflow

### Hot Reload
Code changes are automatically reflected - no need to restart containers.

### Database Access
```bash
# Access PostgreSQL
docker-compose -f docker-compose.local.yml exec postgres psql -U postgres gsthive_dev

# Open Prisma Studio
docker-compose -f docker-compose.local.yml exec app npx prisma studio
```

### Running Tests
```bash
# Unit tests
docker-compose -f docker-compose.local.yml exec app npm test

# E2E tests
docker-compose -f docker-compose.local.yml exec app npm run test:e2e
```

### Viewing Logs
```bash
# All services
docker-compose -f docker-compose.local.yml logs -f

# Specific service
docker-compose -f docker-compose.local.yml logs -f app
docker-compose -f docker-compose.local.yml logs -f cloudflared
```

## Troubleshooting

### Tunnel Not Working
Check Cloudflare tunnel status:
```bash
docker-compose -f docker-compose.local.yml logs cloudflared
```

### Database Connection Issues
```bash
# Restart database
docker-compose -f docker-compose.local.yml restart postgres

# Check database logs
docker-compose -f docker-compose.local.yml logs postgres
```

### Port Conflicts
If you have services running on ports 5432 or 6379:
```bash
# Stop conflicting services or change ports in docker-compose.local.yml
```

## Environment Variables

The `.env.local` file contains:
- `CLOUDFLARE_TUNNEL_TOKEN` - For dev.gsthive.com tunnel
- `NEXTAUTH_URL=https://dev.gsthive.com` - Uses tunnel URL
- `EMAIL_PROVIDER=console` - Emails shown in logs
- Development database and Redis settings

## Stopping Services

```bash
# Stop all services
docker-compose -f docker-compose.local.yml down

# Stop and remove volumes (fresh start)
docker-compose -f docker-compose.local.yml down -v
```

## Notes

- **Emails**: Set to console output - check app logs to see magic link emails
- **Database**: PostgreSQL runs on localhost:5432
- **Redis**: Available on localhost:6379
- **Hot Reload**: Changes to code are reflected immediately
- **Volumes**: Database persists between restarts