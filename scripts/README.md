# Scripts Directory Organization

This directory contains various scripts for development, testing, deployment, and data management.

## Directory Structure

### `/dev`
Development and local environment scripts
- `start-*.sh` - Scripts to start development services
- `setup-dev.sh` - Initial development setup
- `queue-worker.ts` - Queue worker process
- `cron-exchange-rates.ts` - Exchange rate cron job

### `/test`
Testing and verification scripts
- `test-*.ts` - Various test scripts for different features
- `check-*.ts` - Scripts to check system status
- `test-email.mjs` - Email testing script

### `/db`
Database management and fixes
- `fix-*.ts` - Scripts to fix database issues
- `cleanup-*.sql` - SQL cleanup scripts
- `resolve-failed-migration.ts` - Migration resolution

### `/docker`
Docker-related scripts
- `docker-build.sh` - Build Docker images
- `docker-entrypoint.sh` - Container entrypoint

### `/deploy`
Deployment scripts
- `deploy.sh` - Main deployment script
- `VPS_SETUP.sh` - VPS setup instructions

### `/data`
Data seeding and generation
- `seed-*.ts` - Database seeding scripts
- `create-*.ts` - Create test data
- `clean-*.ts` - Clean up test data
- `generate-*.ts` - Generate PDFs and other assets
- `send-*.ts` - Send test emails/invoices

## Usage

Most TypeScript scripts can be run with:
```bash
npm run tsx scripts/<directory>/<script>.ts
```

Shell scripts can be executed directly:
```bash
./scripts/<directory>/<script>.sh
```