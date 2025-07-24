# Single VPS Setup for Multiple Environments

This guide explains how to run both staging and production environments on the same VPS using Docker containers and Cloudflare Tunnels for complete isolation.

## Quick Start

For automated VPS setup, use the provided script:

```bash
# Download and run the setup script
wget https://raw.githubusercontent.com/yourusername/gsthive/main/scripts/deploy/VPS_SETUP.sh
chmod +x VPS_SETUP.sh
./VPS_SETUP.sh
```

This script will:
- Install Docker and Docker Compose
- Set up the deploy user
- Configure firewall and security
- Create directory structure
- Generate SSH keys for GitHub Actions

## Why This Works

Even though both environments run on the same VPS:
- **No exposed ports** - Everything goes through Cloudflare Tunnels
- **Separate containers** - Each environment has its own set of containers
- **Isolated networks** - Docker networks prevent cross-environment communication
- **Different databases** - Complete data isolation
- **Different secrets** - Each environment uses its own credentials

## Architecture

```
Internet
    ↓
Cloudflare (gsthive.com)          Cloudflare (staging.gsthive.com)
    ↓                                      ↓
Tunnel Token (Prod)                  Tunnel Token (Staging)
    ↓                                      ↓
Same VPS
    ├── Production Containers              ├── Staging Containers
    │   ├── cloudflared-prod              │   ├── cloudflared-staging
    │   ├── app-prod                      │   ├── app-staging  
    │   ├── postgres-prod                 │   ├── postgres-staging
    │   └── redis-prod                    │   └── redis-staging
    │                                      │
    └── Network: gsthive-prod-net         └── Network: gsthive-staging-net
        (internal only)                        (internal only)
```

## Benefits of Single VPS

1. **Cost Effective** - One server instead of two
2. **Easier Management** - Single server to maintain
3. **Resource Sharing** - Better utilization of CPU/RAM
4. **Complete Isolation** - Docker ensures environment separation
5. **Easy Scaling** - Can split to multiple VPS later if needed

## Directory Structure

```
/home/deploy/
├── gsthive-production/
│   ├── docker-compose.yml
│   ├── .env.production
│   └── backups/
└── gsthive-staging/
    ├── docker-compose.yml
    ├── .env.staging
    └── backups/
```

## GitHub Secrets Configuration

Since you're using the same VPS, these secrets can be **the same** for both environments:

| Secret | Production | Staging |
|--------|------------|---------|
| VPS_HOST | 123.456.78.90 | 123.456.78.90 ✅ |
| VPS_USER | deploy | deploy ✅ |
| VPS_PORT | 22 | 22 ✅ |
| VPS_SSH_KEY | <same-key> | <same-key> ✅ |

These secrets **must be different**:

| Secret | Production | Staging |
|--------|------------|---------|
| POSTGRES_PASSWORD | prod-pass-123 | staging-pass-456 ❌ |
| REDIS_PASSWORD | prod-redis-789 | staging-redis-012 ❌ |
| NEXTAUTH_SECRET | prod-secret-abc | staging-secret-def ❌ |
| CLOUDFLARE_TUNNEL_TOKEN | prod-tunnel-token | staging-tunnel-token ❌ |

## Updated Deployment Scripts

The deployment workflows automatically handle multiple environments by:

1. **Different deployment directories**:
   - Production: `/home/deploy/gsthive-production/`
   - Staging: `/home/deploy/gsthive-staging/`

2. **Different Docker Compose files**:
   - Each environment gets its own compose file
   - Container names are prefixed (prod/staging)

3. **Different environment files**:
   - `.env.production` for production
   - `.env.staging` for staging

## Setting Up Cloudflare Tunnels

You need **two separate tunnels** in Cloudflare:

### Production Tunnel
1. Name: `gsthive-production`
2. Public hostname: `gsthive.com`
3. Service: `http://app-prod:3000`
4. Get token → Set as `CLOUDFLARE_TUNNEL_TOKEN` in production environment

### Staging Tunnel
1. Name: `gsthive-staging`
2. Public hostname: `staging.gsthive.com`
3. Service: `http://app-staging:3000`
4. Get token → Set as `CLOUDFLARE_TUNNEL_TOKEN` in staging environment

## Container Naming Convention

To avoid conflicts, containers are named with environment prefixes:

**Production:**
- `gsthive-app-prod`
- `gsthive-postgres-prod`
- `gsthive-redis-prod`
- `gsthive-tunnel-prod`

**Staging:**
- `gsthive-app-staging`
- `gsthive-postgres-staging`
- `gsthive-redis-staging`
- `gsthive-tunnel-staging`

## Monitoring Both Environments

```bash
# View all containers
docker ps

# Production logs
docker logs gsthive-app-prod

# Staging logs
docker logs gsthive-app-staging

# Production health
curl http://localhost:3001/api/health  # Internal prod port

# Staging health
curl http://localhost:3002/api/health  # Internal staging port
```

## Resource Considerations

### Minimum VPS Requirements
- **RAM**: 4GB (2GB per environment)
- **CPU**: 2 vCPUs
- **Storage**: 40GB (20GB per environment)
- **OS**: Ubuntu 22.04

### Recommended VPS Specs
- **RAM**: 8GB
- **CPU**: 4 vCPUs
- **Storage**: 80GB SSD
- **OS**: Ubuntu 22.04

## Backup Strategy

```bash
#!/bin/bash
# Backup both environments

# Production backup
docker exec gsthive-postgres-prod pg_dump -U gsthive gsthive > \
  /home/deploy/gsthive-production/backups/prod_$(date +%Y%m%d).sql

# Staging backup  
docker exec gsthive-postgres-staging pg_dump -U gsthive_staging gsthive_staging > \
  /home/deploy/gsthive-staging/backups/staging_$(date +%Y%m%d).sql
```

## Troubleshooting

### Port Conflicts
Since we use internal networks and Cloudflare Tunnels, there are no port conflicts. Each container uses standard ports internally:
- Both apps use port 3000 (internally)
- Both PostgreSQL use port 5432 (internally)
- Both Redis use port 6379 (internally)

### Container Name Conflicts
Always use environment-prefixed names:
```bash
# Wrong
docker-compose up -d

# Right - Production
cd /home/deploy/gsthive-production
docker-compose -p gsthive-prod up -d

# Right - Staging
cd /home/deploy/gsthive-staging
docker-compose -p gsthive-staging up -d
```

### Network Isolation
Each environment has its own internal network:
- Production: `gsthive-prod-net`
- Staging: `gsthive-staging-net`

Containers can only communicate within their own network.

## Migration to Separate VPS

If you need to split environments later:

1. **Backup staging data**
2. **Spin up new VPS**
3. **Update staging GitHub secrets** (VPS_HOST, VPS_SSH_KEY)
4. **Deploy staging to new VPS**
5. **Update Cloudflare tunnel** if needed
6. **Remove staging containers from production VPS**

## Cost Comparison

**Single VPS Setup:**
- 1x 8GB VPS: $40/month
- Total: $40/month

**Dual VPS Setup:**
- 2x 4GB VPS: $20 × 2 = $40/month
- Total: $40/month

Same cost, but single VPS is easier to manage!

## Security Notes

Even on the same VPS:
- ✅ Environments cannot access each other's data
- ✅ Different passwords prevent cross-access
- ✅ Docker network isolation is enforced
- ✅ Cloudflare Tunnels provide additional security
- ✅ No exposed ports reduce attack surface

This setup is production-ready and secure!