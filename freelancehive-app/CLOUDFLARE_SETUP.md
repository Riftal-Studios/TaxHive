# Cloudflare Setup Guide for gsthive.com

This guide will walk you through setting up Cloudflare Tunnel for gsthive.com with complete internal isolation.

## Prerequisites

1. Domain `gsthive.com` added to your Cloudflare account
2. Cloudflare account with Zero Trust access (free tier works)
3. Docker and Docker Compose installed on your server

## Step 1: Add Domain to Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Add `gsthive.com` as a new site
3. Update your domain's nameservers to Cloudflare's nameservers
4. Wait for DNS propagation (usually 5-30 minutes)

## Step 2: Create Cloudflare Tunnel

### Option A: Using Cloudflare Dashboard (Recommended)

1. Go to **Zero Trust → Access → Tunnels**
2. Click **Create a tunnel**
3. Name your tunnel: `gsthive-production`
4. Save the tunnel token - you'll need this for `CLOUDFLARE_TUNNEL_TOKEN`
5. Choose "Docker" as your environment
6. Skip the "Connect your tunnel" step (we'll use docker-compose)
7. Configure your tunnel:
   - Public hostname: `gsthive.com`
   - Service Type: `HTTP`
   - URL: `app:3000`

### Option B: Using Cloudflare CLI

```bash
# Install cloudflared
brew install cloudflare/cloudflare/cloudflared

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create gsthive-production

# Note the Tunnel ID and credentials file location
# Copy the credentials file content - you'll need this
```

## Step 3: Configure DNS

After creating the tunnel, Cloudflare should automatically create a CNAME record:

```
Type: CNAME
Name: @ (or gsthive.com)
Content: <tunnel-id>.cfargotunnel.com
Proxy status: Proxied (orange cloud)
```

Also add:
```
Type: CNAME
Name: www
Content: gsthive.com
Proxy status: Proxied (orange cloud)
```

## Step 4: Environment Variables

Create `.env.production` file with these required values:

```bash
# Get this from Step 2
CLOUDFLARE_TUNNEL_TOKEN=<your-tunnel-token>

# Database credentials
POSTGRES_PASSWORD=<generate-secure-password>
REDIS_PASSWORD=<generate-secure-password>

# NextAuth secret (generate with: openssl rand -base64 64)
NEXTAUTH_SECRET=<64-character-random-string>

# Email configuration (use your SMTP provider)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@gsthive.com

# Exchange rate API (get free key from exchangerate-api.com)
EXCHANGE_RATE_API_KEY=<your-api-key>

# Cron secret (generate with: openssl rand -hex 32)
CRON_SECRET=<32-character-hex-string>
```

## Step 5: Cloudflare Security Settings

In Cloudflare Dashboard for gsthive.com:

### SSL/TLS Settings
- **SSL/TLS encryption mode**: Full (strict)
- **Always Use HTTPS**: ON
- **Minimum TLS Version**: 1.2
- **Automatic HTTPS Rewrites**: ON

### Security Settings
- **Security Level**: Medium or High
- **Challenge Passage**: 30 minutes
- **Browser Integrity Check**: ON

### Firewall Rules (Optional but Recommended)
Create firewall rules to:
1. Block countries you don't serve
2. Challenge suspicious requests
3. Block known bots (except good ones)

Example rule for India-only access:
```
(not ip.geoip.country in {"IN"}) 
Action: Block
```

### Rate Limiting (Recommended)
Set up rate limiting rules:
- Path: `/api/*`
- Requests: 50 per minute
- Action: Challenge

### Page Rules
1. `*gsthive.com/*`
   - Cache Level: Standard
   - Security Level: High
   - Always Use HTTPS: ON

## Step 6: Deploy Application

1. Clone the repository to your server
2. Copy `.env.production.template` to `.env.production` and fill all values
3. Build and start the containers:

```bash
# Build images
docker-compose -f docker-compose.production.yml build

# Start all services
docker-compose -f docker-compose.production.yml up -d

# Check logs
docker-compose -f docker-compose.production.yml logs -f

# Run database migrations
docker-compose -f docker-compose.production.yml exec app npx prisma migrate deploy
```

## Step 7: Health Checks

### Application Health
```bash
# From server (internal)
docker-compose -f docker-compose.production.yml exec app curl http://localhost:3000/api/health

# From internet (after tunnel is up)
curl https://gsthive.com/api/health
```

### Tunnel Status
Check tunnel status in Cloudflare Dashboard:
- Zero Trust → Access → Tunnels → gsthive-production
- Status should show "HEALTHY"

## Step 8: Additional Security (Optional)

### Cloudflare Access
Set up Zero Trust Access policies:
1. Go to Zero Trust → Access → Applications
2. Add application for `gsthive.com`
3. Configure authentication (email OTP, social login, etc.)

### Web Application Firewall (WAF)
If you have a paid plan:
1. Enable WAF
2. Set to "High" sensitivity
3. Enable OWASP rules

## Troubleshooting

### Tunnel not connecting
```bash
# Check tunnel logs
docker-compose -f docker-compose.production.yml logs cloudflared

# Verify token
echo $CLOUDFLARE_TUNNEL_TOKEN
```

### 502 Bad Gateway
- Check if app container is running
- Verify internal network connectivity
- Check app logs for errors

### Database connection issues
```bash
# Test database connection
docker-compose -f docker-compose.production.yml exec postgres psql -U gsthive -d gsthive
```

## Maintenance

### Backup Database
```bash
# Create backup
docker-compose -f docker-compose.production.yml exec postgres pg_dump -U gsthive gsthive > backup_$(date +%Y%m%d).sql

# Restore backup
docker-compose -f docker-compose.production.yml exec -T postgres psql -U gsthive gsthive < backup.sql
```

### Update Application
```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
```

## Monitoring

### Cloudflare Analytics
- Monitor traffic, threats, and performance in Cloudflare Dashboard
- Set up email alerts for tunnel health

### Application Logs
```bash
# View all logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service
docker-compose -f docker-compose.production.yml logs -f app
```

## Required API Keys and Services

1. **Cloudflare Account** (Free)
   - Tunnel token from Zero Trust

2. **Email Service** (Required)
   - SMTP credentials (Gmail, SendGrid, AWS SES, etc.)

3. **Exchange Rate API** (Required)
   - Get free key from: https://exchangerate-api.com
   - 1500 requests/month free

4. **AWS S3** (Optional but recommended)
   - For file storage (invoices, FIRC documents)
   - Create IAM user with S3 access

5. **RBI API** (Optional)
   - If you have access to official RBI rates API

## Security Checklist

- [ ] Strong passwords for PostgreSQL and Redis
- [ ] Unique NEXTAUTH_SECRET generated
- [ ] Cloudflare tunnel token kept secret
- [ ] Environment file not committed to git
- [ ] SSL/TLS set to Full (strict)
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] Regular backups scheduled
- [ ] Monitoring alerts configured

## Support

For issues:
1. Check Docker logs
2. Verify Cloudflare tunnel status
3. Ensure all environment variables are set
4. Check Cloudflare firewall isn't blocking legitimate traffic