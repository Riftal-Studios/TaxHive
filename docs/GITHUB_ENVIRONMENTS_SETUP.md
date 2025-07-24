# GitHub Environments Setup Guide

This guide explains how to set up GitHub Environments with environment-specific secrets and variables for better security and deployment management.

## Overview

Using GitHub Environments provides:
- **Environment-specific secrets** - Different values for staging vs production
- **Protection rules** - Require reviews, restrict deployments
- **Deployment history** - Track what was deployed when
- **Environment URLs** - Quick access to each environment

## Setting Up Environments

### Step 1: Create Environments

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Environments**
3. Click **New environment**

Create these environments:
- **production** - For live site (gsthive.com)
- **staging** - For testing (staging.gsthive.com)

### Step 2: Configure Production Environment

1. Click on **production** environment
2. Set **Environment URL**: `https://gsthive.com`
3. Add **Protection rules**:
   - ✅ Required reviewers (add yourself or team members)
   - ✅ Restrict deployments to `main` branch only
   - ✅ Wait timer: 5 minutes (optional)
4. Add secrets and variables (see below)

### Step 3: Configure Staging Environment

1. Click on **staging** environment
2. Set **Environment URL**: `https://staging.gsthive.com`
3. Add **Protection rules** (optional):
   - Restrict deployments to `staging`, `develop` branches
4. Add secrets and variables (see below)

## Environment-Specific Configuration

### 🔐 Production Environment Secrets

Add these secrets to the **production** environment:

| Secret Name | Description | Example/How to Get |
|------------|-------------|-------------------|
| **VPS Connection** |
| `VPS_HOST` | VPS IP/hostname (can be same for staging) | `123.456.78.90` |
| `VPS_USER` | SSH username (can be same for staging) | `deploy` |
| `VPS_PORT` | SSH port (can be same for staging) | `22` |
| `VPS_SSH_KEY` | Private SSH key (can be same for staging) | Your server SSH key |
| **Database & Cache** |
| `POSTGRES_PASSWORD` | Production DB password | `openssl rand -base64 32` |
| `REDIS_PASSWORD` | Production Redis password | `openssl rand -base64 32` |
| **Authentication** |
| `NEXTAUTH_SECRET` | Production auth secret | `openssl rand -base64 64` |
| `CRON_SECRET` | Production cron secret | `openssl rand -hex 32` |
| **Email** |
| `EMAIL_SERVER` | SMTP connection string | `smtp://user:pass@smtp.gmail.com:587` |
| `SMTP_USER` | SMTP username | `noreply@gsthive.com` |
| `SMTP_PASSWORD` | SMTP password | Your email password |
| **API Keys** |
| `EXCHANGE_RATE_API_KEY` | Exchange rate API | From exchangerate-api.com |
| `CLOUDFLARE_TUNNEL_TOKEN` | Production tunnel | From Cloudflare Zero Trust |
| **AWS (Optional)** |
| `AWS_ACCESS_KEY_ID` | AWS access key | From AWS IAM |
| `AWS_SECRET_ACCESS_KEY` | AWS secret | From AWS IAM |

### 📝 Production Environment Variables

| Variable Name | Value |
|--------------|-------|
| `POSTGRES_USER` | `gsthive` |
| `POSTGRES_DB` | `gsthive` |
| `NEXTAUTH_URL` | `https://gsthive.com` |
| `EMAIL_FROM` | `GST Hive <noreply@gsthive.com>` |
| `SMTP_FROM` | `noreply@gsthive.com` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `AWS_REGION` | `ap-south-1` |
| `AWS_S3_BUCKET` | `gsthive-production` |

### 🔐 Staging Environment Secrets

Add these secrets to the **staging** environment:

| Secret Name | Description | Different from Production? |
|------------|-------------|---------------------------|
| `VPS_HOST` | VPS IP (same server OK!) | No - can use same VPS |
| `VPS_USER` | SSH username | No - same user |
| `VPS_PORT` | SSH port | No - same port |
| `VPS_SSH_KEY` | Private SSH key | No - same key |
| `POSTGRES_PASSWORD` | Staging DB password | Yes - different password |
| `REDIS_PASSWORD` | Staging Redis password | Yes - different password |
| `NEXTAUTH_SECRET` | Staging auth secret | Yes - different secret |
| `CRON_SECRET` | Staging cron secret | Yes - different secret |
| `EMAIL_SERVER` | SMTP connection | Can be same |
| `SMTP_USER` | SMTP username | Can be same |
| `SMTP_PASSWORD` | SMTP password | Can be same |
| `EXCHANGE_RATE_API_KEY` | API key | Can be same |
| `CLOUDFLARE_TUNNEL_TOKEN` | Staging tunnel | Yes - different tunnel |
| `AWS_ACCESS_KEY_ID` | AWS key | Can be same |
| `AWS_SECRET_ACCESS_KEY` | AWS secret | Can be same |

### 📝 Staging Environment Variables

| Variable Name | Value |
|--------------|-------|
| `POSTGRES_USER` | `gsthive_staging` |
| `POSTGRES_DB` | `gsthive_staging` |
| `NEXTAUTH_URL` | `https://staging.gsthive.com` |
| `EMAIL_FROM` | `GST Hive Staging <staging@gsthive.com>` |
| `SMTP_FROM` | `staging@gsthive.com` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `AWS_REGION` | `ap-south-1` |
| `AWS_S3_BUCKET` | `gsthive-staging` |

## Setting Protection Rules

### Production Protection Rules

1. In production environment settings, click **Protection rules**
2. Enable these options:

**Required reviewers**:
- Add yourself and/or team members
- Prevents accidental deployments

**Deployment branches**:
- Type: Selected branches
- Add pattern: `main`
- Only main branch can deploy to production

**Environment secrets**:
- ✅ Allow administrators to bypass

**Wait timer** (optional):
- Set to 5-10 minutes
- Gives time to cancel if needed

### Staging Protection Rules

**Deployment branches**:
- Type: Selected branches
- Add patterns: `staging`, `develop`
- Only these branches can deploy to staging

## Using Environments in Workflows

The workflows are already configured to use environments:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: 
      name: production
      url: https://gsthive.com
```

This ensures:
- Secrets are loaded from the correct environment
- Protection rules are enforced
- Deployment history is tracked
- Environment URL is displayed

## Testing Your Setup

### 1. Test Staging Deployment

```bash
# Create staging branch
git checkout -b staging
git push origin staging

# This triggers staging deployment
```

### 2. Test Production Deployment

```bash
# Merge to main
git checkout main
git merge staging
git push origin main

# This triggers production deployment
# Will require approval if protection rules are set
```

### 3. Check Deployment History

1. Go to repository home
2. Click **Environments** in sidebar
3. Click on environment name
4. View deployment history

## Environment-Specific Features

### Different Cloudflare Tunnels

Each environment uses its own tunnel:
- **Production**: `gsthive.com`
- **Staging**: `staging.gsthive.com`

Create separate tunnels in Cloudflare:
1. Production tunnel → production token
2. Staging tunnel → staging token

### Different Databases

Each environment has isolated data:
- **Production**: `gsthive` database
- **Staging**: `gsthive_staging` database

### Different S3 Buckets

Keep files separate:
- **Production**: `gsthive-production`
- **Staging**: `gsthive-staging`

## Security Best Practices

1. **Different passwords** for each environment
2. **Different servers** for staging and production
3. **Restrict production** deployments to main branch
4. **Require reviews** for production deployments
5. **Use different API keys** where possible
6. **Monitor deployments** regularly

## Troubleshooting

### Deployment waiting for approval
- Check environment protection rules
- Ensure you're an approved reviewer
- Check branch restrictions

### Secrets not available
- Verify secrets are in correct environment
- Check workflow references correct environment
- Ensure environment name matches exactly

### Wrong values being used
- Check if using repository secrets instead of environment secrets
- Verify workflow has `environment:` specified
- Clear GitHub Actions cache

## Migration from Repository Secrets

If you have existing repository secrets:

1. Copy values to appropriate environment
2. Delete repository-level secrets
3. Workflows automatically use environment secrets

## Benefits of This Setup

1. **Isolation**: Staging mistakes don't affect production
2. **Security**: Production secrets stay in production
3. **Flexibility**: Different configs per environment
4. **Auditability**: Track who deployed what when
5. **Safety**: Protection rules prevent accidents
6. **Clarity**: Clear which environment uses which values