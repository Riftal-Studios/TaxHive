# Local Development Setup (Without Docker)

This guide explains how to run GSTHive locally without Docker.

## Prerequisites

- Node.js 20+ installed
- PostgreSQL 15+ installed and running
- Redis 7+ installed and running (optional, for caching)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL

If you don't have PostgreSQL installed:

**macOS:**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download and install from https://www.postgresql.org/download/windows/

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE gsthive;

# Create user (optional)
CREATE USER gsthive WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE gsthive TO gsthive;

# Exit
\q
```

### 4. Set Up Environment Variables

Create `.env` file in the project root:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/gsthive?schema=public"

# For SQLite (if you prefer for development)
# DATABASE_URL="file:./dev.db"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-development-secret-key-here"

# Email (for magic links)
EMAIL_SERVER="smtp://username:password@smtp.gmail.com:587"
EMAIL_FROM="noreply@gsthive.local"

# Cron Secret
CRON_SECRET="your-cron-secret-for-exchange-rates"

# Redis (optional)
REDIS_URL="redis://localhost:6379"
```

### 5. Run Database Migrations

```bash
# Generate Prisma Client
npm run generate

# Run migrations
npm run db:migrate

# (Optional) Seed the database with sample data
npm run db:seed
```

### 6. Start the Development Server

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Quick Start Script

Create a `start-local.sh` script:

```bash
#!/bin/bash
echo "🚀 Starting GSTHive locally..."

# Check if PostgreSQL is running
if ! pg_isready > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running. Please start it first."
    exit 1
fi

# Run migrations
echo "📊 Running database migrations..."
npm run db:migrate

# Start the dev server
echo "🌟 Starting development server..."
npm run dev
```

Make it executable:
```bash
chmod +x start-local.sh
```

Then run:
```bash
./start-local.sh
```

## Using SQLite Instead (Simpler Setup)

If you want to avoid PostgreSQL setup, you can use SQLite:

1. Update `.env`:
```bash
DATABASE_URL="file:./dev.db"
```

2. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

3. Run migrations:
```bash
npm run db:push
```

## Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues
```bash
# Test PostgreSQL connection
psql -U postgres -d gsthive -c "SELECT 1;"

# Check PostgreSQL status
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

### Missing Dependencies
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Exchange Rate Fetching
To test exchange rate updates locally:
```bash
curl -X GET http://localhost:3000/api/cron/exchange-rates \
  -H "Authorization: Bearer your-cron-secret-for-exchange-rates"
```

## Development Tips

1. **Prisma Studio** - Visual database editor:
   ```bash
   npm run db:studio
   ```

2. **Watch Mode** - Auto-restart on changes:
   The Next.js dev server automatically reloads on file changes

3. **Test Email** - Use services like:
   - Ethereal Email: https://ethereal.email/
   - MailHog: Local SMTP testing server
   - Mailtrap: Email testing service

4. **Environment Variables** - Use different `.env` files:
   - `.env.local` - Local overrides (gitignored)
   - `.env.development` - Development defaults
   - `.env.test` - Test environment

## Running Tests

```bash
# Unit tests
npm run test:unit

# Run specific test file
npm run test -- tests/unit/invoice.test.ts

# E2E tests (requires server running)
npm run test:e2e
```

## Next Steps

Once everything is running:
1. Visit http://localhost:3000
2. Sign up with your email
3. Check console logs for magic link (if email not configured)
4. Create clients and invoices
5. Test PDF generation

Happy coding! 🎉