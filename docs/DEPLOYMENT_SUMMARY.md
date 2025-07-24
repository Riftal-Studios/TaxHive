# GST Hive Production Deployment Summary

## Overview

The production deployment is fully containerized with **zero exposed ports** on the host machine. The only way to access the application is through `gsthive.com` via Cloudflare Tunnel.

## Architecture

```
Internet → Cloudflare → Cloudflare Tunnel → Internal Docker Network → App
                                                    ↓
                                              PostgreSQL
                                                    ↓
                                                 Redis
```

## Files Created

1. **docker-compose.production.yml** - Production Docker Compose configuration
2. **Dockerfile.production** - Optimized production Dockerfile
3. **.env.production.template** - Environment variables template
4. **cloudflare-tunnel-config.yml** - Cloudflare tunnel configuration
5. **CLOUDFLARE_SETUP.md** - Detailed Cloudflare setup guide
6. **deploy.sh** - Deployment management script
7. **.dockerignore** - Optimized Docker build excludes

## Required Services & Credentials

### 1. Cloudflare (Required)
- **What you need**: Cloudflare account with gsthive.com domain
- **Get from**: Cloudflare Zero Trust → Tunnels
- **Required**: `CLOUDFLARE_TUNNEL_TOKEN`

### 2. PostgreSQL Database (Included)
- **What you need**: Strong password
- **Generate**: `openssl rand -base64 32`
- **Required**: `POSTGRES_PASSWORD`

### 3. Redis Cache (Included)
- **What you need**: Strong password
- **Generate**: `openssl rand -base64 32`
- **Required**: `REDIS_PASSWORD`

### 4. NextAuth Secret (Required)
- **What you need**: 64-character random string
- **Generate**: `openssl rand -base64 64`
- **Required**: `NEXTAUTH_SECRET`

### 5. Email Service (Required)
Choose one:
- **Gmail**: App-specific password
- **SendGrid**: API key
- **AWS SES**: SMTP credentials
- **Required**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`

### 6. Exchange Rate API (Required)
- **Get from**: https://exchangerate-api.com
- **Free tier**: 1500 requests/month
- **Required**: `EXCHANGE_RATE_API_KEY`

### 7. AWS S3 (Optional but Recommended)
- **For**: File storage (invoices, FIRC documents)
- **Required**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`

## Quick Start Deployment

### 1. Prepare Environment
```bash
# Copy environment template
cp .env.production.template .env.production

# Edit and fill all required values
nano .env.production
```

### 2. Deploy Application
```bash
# Build images
./deploy.sh build

# Start all services
./deploy.sh up

# Run database migrations
./deploy.sh migrate

# Check health
./deploy.sh health
```

### 3. Cloudflare Setup
1. Add gsthive.com to Cloudflare
2. Create tunnel in Zero Trust → Tunnels
3. Save tunnel token to `.env.production`
4. Configure DNS (automatic with tunnel)

## Services Included

### 1. PostgreSQL Database
- Container: `gsthive-postgres`
- Internal only, no exposed ports
- Persistent data volume
- Automatic health checks

### 2. Redis Cache
- Container: `gsthive-redis`
- Internal only, no exposed ports
- Used for queues and caching
- Password protected

### 3. Next.js Application
- Container: `gsthive-app`
- Internal port 3000 (not exposed)
- Includes Puppeteer for PDF generation
- Automatic migrations on startup

### 4. Cloudflare Tunnel
- Container: `gsthive-tunnel`
- Only service with external connectivity
- Routes traffic from gsthive.com to app

### 5. Queue Worker
- Container: `gsthive-queue-worker`
- Processes background jobs
- Email sending, PDF generation

### 6. Cron Scheduler
- Container: `gsthive-cron`
- Daily exchange rate updates
- LUT expiry notifications

## Security Features

1. **No Exposed Ports**: All services on internal network
2. **Cloudflare Protection**: DDoS, WAF, rate limiting
3. **Non-root Containers**: Run as unprivileged user
4. **Environment Isolation**: Secrets in environment files
5. **HTTPS Only**: Enforced by Cloudflare
6. **Internal Network**: Bridge network with internal flag

## Maintenance Commands

```bash
# View logs
./deploy.sh logs
./deploy.sh logs app
./deploy.sh logs cloudflared

# Backup database
./deploy.sh backup

# Restore database
./deploy.sh restore backup_20240723.sql

# Update application
./deploy.sh update

# Access container shell
./deploy.sh shell app
./deploy.sh shell postgres

# Restart services
./deploy.sh restart
```

## Monitoring

### Application Health
- Endpoint: https://gsthive.com/api/health
- Internal: http://app:3000/api/health

### Cloudflare Analytics
- Traffic metrics
- Security events
- Performance data

### Container Logs
```bash
# All logs
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f app
```

## Troubleshooting

### Tunnel Not Connecting
1. Check token: `echo $CLOUDFLARE_TUNNEL_TOKEN`
2. Check logs: `./deploy.sh logs cloudflared`
3. Verify tunnel status in Cloudflare dashboard

### Database Issues
1. Check connection: `./deploy.sh shell postgres`
2. Run migrations: `./deploy.sh migrate`
3. Check logs: `./deploy.sh logs postgres`

### Application Errors
1. Check health: `./deploy.sh health`
2. View logs: `./deploy.sh logs app`
3. Check env vars: All required variables set

## Backup Strategy

### Daily Backups
```bash
# Add to crontab
0 2 * * * cd /path/to/app && ./deploy.sh backup
```

### Backup Files
- Database: `backup_YYYYMMDD_HHMMSS.sql`
- Uploads: Volume `app_uploads`
- Invoices: Volume `app_public`

## Scaling Considerations

### Horizontal Scaling
- Add more app containers
- Use external PostgreSQL (RDS)
- Use external Redis (ElastiCache)
- Multiple Cloudflare tunnels

### Performance Optimization
- Enable Cloudflare caching
- Use Cloudflare CDN for assets
- Optimize Next.js build
- Enable Redis caching

## Cost Estimation (Monthly)

1. **Cloudflare**: Free (Pro: $20/month recommended)
2. **Server**: $20-50 (2-4GB RAM VPS)
3. **Email**: $0-25 (depends on volume)
4. **S3 Storage**: $1-5 (depends on usage)
5. **Exchange Rate API**: Free (under 1500 req/month)

**Total**: ~$25-100/month

## Support Checklist

Before requesting support:
- [ ] All environment variables set
- [ ] Cloudflare tunnel shows HEALTHY
- [ ] Database migrations completed
- [ ] Health check returns 200
- [ ] No errors in container logs
- [ ] DNS properly configured
- [ ] SSL set to Full (strict)

## Next Steps

1. Set up monitoring (Sentry, Datadog)
2. Configure backups automation
3. Set up CI/CD pipeline
4. Add staging environment
5. Implement log aggregation