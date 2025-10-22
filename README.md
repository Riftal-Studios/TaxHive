# TaxHive 🐝

A modern GST-compliant invoice management system for Indian freelancers. Built with Next.js, TypeScript, and PostgreSQL.

## CI/CD Status

![Test](https://github.com/Riftal-Studios/TaxHive/actions/workflows/test.yml/badge.svg)
![Deploy to Staging](https://github.com/Riftal-Studios/TaxHive/actions/workflows/staging.yml/badge.svg)
![Deploy to Production](https://github.com/Riftal-Studios/TaxHive/actions/workflows/production.yml/badge.svg)
![Promote to Production](https://github.com/Riftal-Studios/TaxHive/actions/workflows/promote-to-production.yml/badge.svg)
![Rollback](https://github.com/Riftal-Studios/TaxHive/actions/workflows/rollback.yml/badge.svg)

> **Note**: This project uses automated CI/CD with GitHub Actions for seamless deployments to staging and production environments.

## Getting Started

### Prerequisites

- Node.js 18+ 
- Supabase account (for managed PostgreSQL)
- Redis (for queue system)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new project at [supabase.com](https://supabase.com)
   - Copy the database connection strings from Project Settings > Database

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your Supabase credentials:
   - `DATABASE_DB_URL` - Connection pooler URL (for Prisma)
   - `DATABASE_DIRECT_URL` - Direct connection URL (for migrations)
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_API_KEY` - Your Supabase anon key

4. **Set up the database:**
   ```bash
   # Run migrations
   npx prisma migrate dev
   
   # Seed development data (optional)
   npm run db:seed
   ```

5. **Start Redis:**
   ```bash
   # In a separate terminal
   redis-server
   ```

6. **Start the development server:**

   **Option A: Traditional local development**
   ```bash
   npm run dev
   ```
   Access at: http://localhost:3000

   **Option B: With Cloudflare Tunnel (Recommended)**
   ```bash
   ./start-local-tunnel.sh
   ```
   Access at: https://dev.taxhive.app
   
   See [Local Tunnel Setup](docs/LOCAL_TUNNEL_SETUP.md) for details.

### Additional Services

**Queue Worker (for background jobs):**
```bash
# In a separate terminal
npm run queue:worker
```

**Exchange Rate Updates (cron job):**
```bash
# Run manually
npm run cron:exchange-rates
```

## Development Commands

```bash
# Development
npm run dev          # Start Next.js dev server
npm run queue:worker # Start queue worker

# Database
npm run db:migrate   # Run migrations
npm run db:push      # Push schema changes (dev)
npm run db:seed      # Seed development data
npm run db:studio    # Open Prisma Studio

# Testing
npm run test         # Run all tests
npm run test:unit    # Run unit tests
npm run test:e2e     # Run E2E tests

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks

# Build
npm run build        # Build for production
npm run start        # Start production server
```

## Project Structure

```
taxhive-app/
├── app/                 # Next.js App Router pages
├── components/          # React components
├── server/             # tRPC routers and backend logic
├── lib/                # Shared utilities
├── prisma/             # Database schema and migrations
├── tests/              # Test files
├── public/             # Static assets
└── docker/             # Docker configurations
```

## Features Implemented

- ✅ Authentication with magic links
- ✅ User profile management with GSTIN/PAN validation
- ✅ User onboarding flow
- ✅ LUT (Letter of Undertaking) management
- ✅ Dashboard with metrics and charts
- ✅ Invoice creation and management
- ✅ Client management
- ✅ PDF invoice generation
- ✅ Multi-currency support with RBI exchange rates
- ✅ GST compliance for exports (0% IGST)

## Documentation

Additional documentation is available in the `/docs` directory:
- **[GITHUB_ENVIRONMENTS_SETUP.md](docs/GITHUB_ENVIRONMENTS_SETUP.md)** - Automated deployment setup
- **[SINGLE_VPS_SETUP.md](docs/SINGLE_VPS_SETUP.md)** - Multi-environment on one server
- **[LOCAL_SETUP.md](docs/local-setup.md)** - Local development without Docker
- **[queue-system.md](docs/queue-system.md)** - Background job processing

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** tRPC, Prisma, Supabase (PostgreSQL)
- **Queue:** BullMQ with Redis
- **Authentication:** NextAuth.js
- **Testing:** Vitest, Playwright
- **Charts:** Recharts
- **PDF:** React PDF

## License

MIT