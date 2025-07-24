# GitHub Environment Secrets Configuration Summary

## Quick Setup Guide

### 1. Create Environments

Go to: **Settings** → **Environments** → **New environment**

Create two environments:
- `production` (for gsthive.com)
- `staging` (for staging.gsthive.com)

### 2. Production Environment Setup

#### Add these Secrets:
```bash
# VPS Connection
VPS_HOST=<your-production-vps-ip>
VPS_USER=<ssh-username>
VPS_PORT=22
VPS_SSH_KEY=<paste-entire-private-key>

# Database & Cache
POSTGRES_PASSWORD=<generate: openssl rand -base64 32>
REDIS_PASSWORD=<generate: openssl rand -base64 32>

# Authentication
NEXTAUTH_SECRET=<generate: openssl rand -base64 64>
CRON_SECRET=<generate: openssl rand -hex 32>

# Email
EMAIL_SERVER=smtp://user:pass@smtp.gmail.com:587
SMTP_USER=noreply@gsthive.com
SMTP_PASSWORD=<your-app-password>

# API Keys
EXCHANGE_RATE_API_KEY=<from-exchangerate-api.com>
CLOUDFLARE_TUNNEL_TOKEN=<production-tunnel-token>

# AWS (Optional)
AWS_ACCESS_KEY_ID=<if-using-s3>
AWS_SECRET_ACCESS_KEY=<if-using-s3>
```

#### Add these Variables:
```bash
POSTGRES_USER=gsthive
POSTGRES_DB=gsthive
NEXTAUTH_URL=https://gsthive.com
EMAIL_FROM=GST Hive <noreply@gsthive.com>
SMTP_FROM=noreply@gsthive.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
AWS_REGION=ap-south-1
AWS_S3_BUCKET=gsthive-production
```

#### Set Protection Rules:
- ✅ Required reviewers
- ✅ Restrict to `main` branch only
- ✅ Environment URL: `https://gsthive.com`

### 3. Staging Environment Setup

#### Add these Secrets (different values from production):
```bash
# VPS Connection (can use same server!)
VPS_HOST=<same-as-production>
VPS_USER=<same-as-production>
VPS_PORT=<same-as-production>
VPS_SSH_KEY=<same-as-production>

# Database & Cache (different passwords!)
POSTGRES_PASSWORD=<different-password>
REDIS_PASSWORD=<different-password>

# Authentication (different secrets!)
NEXTAUTH_SECRET=<different-secret>
CRON_SECRET=<different-secret>

# Email (can be same)
EMAIL_SERVER=smtp://user:pass@smtp.gmail.com:587
SMTP_USER=staging@gsthive.com
SMTP_PASSWORD=<your-app-password>

# API Keys
EXCHANGE_RATE_API_KEY=<can-be-same>
CLOUDFLARE_TUNNEL_TOKEN=<staging-tunnel-token>

# AWS (Optional)
AWS_ACCESS_KEY_ID=<can-be-same>
AWS_SECRET_ACCESS_KEY=<can-be-same>
```

#### Add these Variables:
```bash
POSTGRES_USER=gsthive_staging
POSTGRES_DB=gsthive_staging
NEXTAUTH_URL=https://staging.gsthive.com
EMAIL_FROM=GST Hive Staging <staging@gsthive.com>
SMTP_FROM=staging@gsthive.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
AWS_REGION=ap-south-1
AWS_S3_BUCKET=gsthive-staging
```

#### Set Protection Rules:
- ✅ Restrict to `staging`, `develop` branches
- ✅ Environment URL: `https://staging.gsthive.com`

### 4. Test Your Configuration

Run the test workflow:
1. Go to **Actions** tab
2. Select **Test Environment Secrets**
3. Click **Run workflow**
4. Choose environment to test
5. Check results

### 5. Generate Secrets Script

```bash
#!/bin/bash
# Run this locally to generate secure secrets

echo "=== Generated Secrets for Copy/Paste ==="
echo ""
echo "# Database & Cache"
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo ""
echo "# Authentication"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 64)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
echo ""
echo "# Generate different sets for staging and production!"
```

## Key Differences from Repository Secrets

1. **Environment Isolation**: Each environment has its own secrets
2. **Protection Rules**: Can require approval for production
3. **Branch Restrictions**: Control which branches deploy where
4. **Deployment History**: Track deployments per environment
5. **Environment URLs**: Quick links to each environment

## Deployment Workflows

The workflows automatically use environment secrets:

- **Production**: Push to `main` → Uses production environment
- **Staging**: Push to `staging` → Uses staging environment
- **Rollback**: Manual trigger → Uses selected environment

## Benefits

✅ **Security**: Production secrets never exposed to staging
✅ **Flexibility**: Different configs per environment
✅ **Safety**: Protection rules prevent accidents
✅ **Clarity**: Clear separation of environments
✅ **Auditability**: Full deployment history

## Important Notes

⚠️ **Different Passwords**: Always use different passwords for staging/production
⚠️ **Different Tokens**: Each environment needs its own Cloudflare tunnel
⚠️ **Test First**: Always test in staging before production
⚠️ **Backup Secrets**: Keep a secure backup of all secrets