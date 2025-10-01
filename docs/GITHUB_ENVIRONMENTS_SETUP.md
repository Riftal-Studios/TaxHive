# GitHub Environments Setup Guide

This guide explains how to set up GitHub Environments for automated deployments.

## How Deployment Works

```
Push to GitHub → GitHub Actions → Build Docker Image → Deploy to VPS → Cloudflare Tunnel → Live Site
```

**Fully Automated:**
- Push to `main` → Deploys to production (gsthive.com)
- Push to `staging` → Deploys to staging (staging.gsthive.com)
- No manual steps required!

## Overview

GitHub Environments provide:
- **Environment-specific secrets** - Different values for staging vs production
- **Protection rules** - Require reviews, restrict deployments
- **Deployment history** - Track what was deployed when
- **Environment URLs** - Quick access to each environment

## Prerequisites

- GitHub repository for your project
- GitHub Actions enabled
- Deployment workflows in `.github/workflows/`

## Setting Up Environments

### Step 1: Create Environments

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Environments**
3. Click **New environment**

Create these environments:
- **production** - For live site (gsthive.com)
- **staging** - For testing (staging.gsthive.com)

### Step 2: Configure Protection Rules

#### Production Environment

1. Click on **production** environment
2. Set **Environment URL**: `https://gsthive.com`
3. Add **Protection rules**:
   - ✅ Required reviewers (add yourself or team members)
   - ✅ Restrict deployments to `main` branch only
   - ✅ Wait timer: 5 minutes (optional)

#### Staging Environment

1. Click on **staging** environment
2. Set **Environment URL**: `https://staging.gsthive.com`
3. Add **Protection rules** (optional):
   - Restrict deployments to `staging`, `develop` branches

## Configuring Secrets and Variables

For a complete list of all environment variables with documentation, see `.env.example` in the root directory.

### Understanding Secrets vs Variables

**Secrets** (sensitive data):
- Passwords, API keys, tokens
- Encrypted and masked in logs
- Use: `${{ secrets.SECRET_NAME }}`

**Variables** (non-sensitive configuration):
- Hostnames, ports, usernames, URLs
- Visible in logs
- Use: `${{ vars.VARIABLE_NAME }}`

### Production Environment Configuration

#### Secrets to Add:
```yaml
# Authentication & Security
VPS_SSH_KEY          # Your server's private SSH key
POSTGRES_PASSWORD    # Generate: openssl rand -base64 32
REDIS_PASSWORD       # Generate: openssl rand -base64 32
NEXTAUTH_SECRET      # Generate: openssl rand -base64 64
CRON_SECRET          # Generate: openssl rand -hex 32

# Email (Amazon SES)
EMAIL_SERVER         # smtp://USER:PASS@email-smtp.region.amazonaws.com:587
AWS_SES_ACCESS_KEY_ID
AWS_SES_SECRET_ACCESS_KEY

# API Keys
EXCHANGE_RATE_API_KEY
CLOUDFLARE_TUNNEL_TOKEN

# AWS (Optional)
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

#### Variables to Add:
```yaml
# VPS Connection
VPS_HOST: your.server.ip
VPS_USER: deploy
VPS_PORT: 22

# Database
POSTGRES_USER: gsthive
POSTGRES_DB: gsthive

# Application
NEXTAUTH_URL: https://gsthive.com
EMAIL_PROVIDER: ses
EMAIL_FROM: GST Hive <noreply@gsthive.com>
AWS_SES_REGION: ap-south-1

# AWS (Optional)
AWS_REGION: ap-south-1
AWS_S3_BUCKET: gsthive-production
AWS_S3_REGION: ap-south-1              # Optional: Override if different from AWS_REGION
AWS_S3_ENDPOINT:                        # Optional: For S3-compatible services (R2, MinIO)
AWS_S3_FORCE_PATH_STYLE: false         # Optional: Set to true for MinIO/LocalStack
AWS_S3_PUBLIC_READ: false              # Optional: Set to true for public PDFs
```

### Staging Environment Configuration

Use the same structure as production but with:
- Different passwords and secrets (always separate)
- Different database names (e.g., `gsthive_staging`)
- Different URLs (e.g., `https://staging.gsthive.com`)
- Different S3 buckets if using file storage

## Quick Setup Commands

Generate all required secrets at once:

```bash
echo "=== Production Secrets ==="
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"
echo "NEXTAUTH_SECRET=$(openssl rand -base64 64)"
echo "CRON_SECRET=$(openssl rand -hex 32)"

echo -e "\n=== Staging Secrets ==="
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32)"
echo "REDIS_PASSWORD=$(openssl rand -base64 32)"  
echo "NEXTAUTH_SECRET=$(openssl rand -base64 64)"
echo "CRON_SECRET=$(openssl rand -hex 32)"
```

## Using Environments in Workflows

The workflows automatically use the correct environment:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: 
      name: production
      url: https://gsthive.com
```

This ensures:
- Correct secrets and variables are loaded
- Protection rules are enforced
- Deployment is tracked in GitHub

## Testing Your Setup

### 1. Test Environment Configuration

Run the environment test workflow:

```bash
# Go to Actions → Test Environment Secrets → Run workflow
# Select the environment to test
```

### 2. Test Deployment

```bash
# Staging deployment
git checkout -b staging
git push origin staging

# Production deployment  
git checkout main
git merge staging
git push origin main
```

## Viewing Deployment History

1. Go to repository home
2. Click **Environments** in sidebar
3. Click on environment name
4. View deployment history and status

## Best Practices

1. **Never share secrets** between production and staging
2. **Use strong passwords** - Always generate randomly
3. **Rotate secrets regularly** - Especially after team changes
4. **Test in staging first** - Always deploy to staging before production
5. **Enable protection rules** - Prevent accidental deployments

## Troubleshooting

### Deployment Waiting for Approval

- Check environment protection rules
- Ensure you're an approved reviewer
- Verify branch restrictions match your branch

### Secrets Not Available

- Verify secrets are in correct environment
- Check workflow specifies `environment:` field
- Ensure exact name matching (case-sensitive)

### Wrong Values Being Used

- Check not using repository secrets (use environment secrets)
- Verify correct environment name in workflow
- Clear GitHub Actions cache if needed

## Migration from Repository Secrets

If you have existing repository-level secrets:

1. Copy each secret to appropriate environment
2. Update workflows to specify environment
3. Delete repository-level secrets
4. Test deployments

The environment-specific approach is more secure and maintainable.