# GSTHive Deployment Guide

This guide covers deploying GSTHive using Docker and Terraform.

## Prerequisites

- Docker and Docker Compose installed
- Fly.io account (for cloud deployment)
- Terraform installed (for infrastructure management)
- Node.js 20+ (for local development)

## Local Development with Docker

1. **Start services with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

2. **Run database migrations:**
   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

3. **Access the application:**
   - App: http://localhost:3000
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379

## Production Deployment on Fly.io

### Initial Setup

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Login to Fly.io:**
   ```bash
   fly auth login
   ```

3. **Create your app:**
   ```bash
   fly launch --no-deploy
   ```

### Deploy with Terraform

1. **Configure Terraform variables:**
   ```bash
   cd terraform
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

2. **Initialize Terraform:**
   ```bash
   terraform init
   ```

3. **Plan deployment:**
   ```bash
   terraform plan
   ```

4. **Deploy infrastructure:**
   ```bash
   terraform apply
   ```

### Deploy with Fly CLI

1. **Set environment variables:**
   ```bash
   fly secrets set \
     NEXTAUTH_SECRET="your-secret" \
     EMAIL_SERVER="smtp://..." \
     CRON_SECRET="your-cron-secret"
   ```

2. **Deploy the application:**
   ```bash
   ./scripts/deploy.sh
   ```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_URL` | Application URL | `https://gsthive.com` |
| `NEXTAUTH_SECRET` | NextAuth encryption secret | Generate with `openssl rand -base64 32` |
| `EMAIL_SERVER` | SMTP server configuration | `smtp://user:pass@smtp.gmail.com:587` |
| `EMAIL_FROM` | Sender email address | `noreply@gsthive.com` |
| `CRON_SECRET` | Secret for cron job auth | Generate with `openssl rand -hex 32` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `PORT` | Application port | `3000` |
| `NODE_ENV` | Environment | `production` |

## Database Management

### Run migrations:
```bash
# Local
npm run db:migrate

# Production (Fly.io)
fly ssh console -C "npx prisma migrate deploy"
```

### Seed database:
```bash
# Local
npm run db:seed

# Production (Fly.io)
fly ssh console -C "npm run db:seed"
```

## Monitoring and Logs

### View application logs:
```bash
fly logs
```

### Check application status:
```bash
fly status
```

### SSH into container:
```bash
fly ssh console
```

## Scaling

### Horizontal scaling:
```bash
fly scale count 2
```

### Vertical scaling:
```bash
fly scale vm shared-cpu-2x --memory 1024
```

## Backup and Recovery

### Database backup:
```bash
fly postgres backup create
```

### List backups:
```bash
fly postgres backup list
```

### Restore from backup:
```bash
fly postgres backup restore <backup-id>
```

## Troubleshooting

### Common Issues

1. **Puppeteer fails in Docker:**
   - Ensure Chromium dependencies are installed
   - Check PUPPETEER_SKIP_CHROMIUM_DOWNLOAD env var

2. **Database connection issues:**
   - Verify DATABASE_URL is correct
   - Check if database is running: `fly postgres list`

3. **Cron jobs not running:**
   - Verify CRON_SECRET is set
   - Check fly.toml cron configuration

### Debug Commands

```bash
# Check environment variables
fly ssh console -C "printenv | grep -E 'DATABASE|NEXT'"

# Test database connection
fly ssh console -C "npx prisma db pull"

# Run health check
curl https://your-app.fly.dev/api/health
```

## Security Considerations

1. **Always use HTTPS** in production
2. **Rotate secrets** regularly
3. **Keep dependencies updated**
4. **Enable Fly.io's DDoS protection**
5. **Use strong database passwords**
6. **Implement rate limiting** for API endpoints

## CI/CD Integration

For automated deployments, add to your GitHub Actions:

```yaml
- name: Deploy to Fly.io
  uses: superfly/flyctl-actions@v1
  with:
    args: "deploy"
  env:
    FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```