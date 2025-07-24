# Environment Variables Guide

This guide explains the environment variable setup for GST Hive.

## Environment Files

```
.env.example              # Template with all variables documented
.env.development          # Development defaults (committed)
.env.local               # Your local overrides (gitignored)
.env.production.template  # Production template (committed)
.env.production          # Production values (gitignored)
```

## Usage

### Local Development

```bash
# Option 1: Use development defaults
cp .env.development .env.local
# Edit .env.local as needed

# Option 2: Start from example
cp .env.example .env.local
# Configure all values
```

### Production

```bash
cp .env.production.template .env.production
# Fill in all production values
```

## Required Variables

### Database
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_USER` - Database username
- `POSTGRES_PASSWORD` - Database password
- `POSTGRES_DB` - Database name

### Authentication
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - Secret for JWT encryption (generate with `openssl rand -base64 64`)

### Email
- `EMAIL_SERVER` - SMTP connection string
- `EMAIL_FROM` - Sender email address
- `SMTP_*` - SMTP configuration details

### Redis
- `REDIS_URL` or `REDIS_HOST/PORT` - For queue system
- `REDIS_PASSWORD` - If authentication is enabled

### APIs
- `EXCHANGE_RATE_API_KEY` - For currency conversion
- `CLOUDFLARE_TUNNEL_TOKEN` - For production deployment

## Security Notes

1. **Never commit** `.env`, `.env.local`, or `.env.production`
2. **Always use strong passwords** for production
3. **Rotate secrets regularly**
4. **Use environment-specific values** (don't reuse dev passwords in prod)

## Variable Precedence

Next.js loads environment variables in this order:
1. `process.env`
2. `.env.$(NODE_ENV).local`
3. `.env.local` (not loaded when NODE_ENV=test)
4. `.env.$(NODE_ENV)`
5. `.env`

Variables in files loaded earlier override those in files loaded later.