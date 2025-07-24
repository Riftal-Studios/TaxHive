# GST Hive 🐝

A modern GST-compliant invoice management system for Indian businesses exporting services. Built with Next.js, TypeScript, and PostgreSQL.

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- Redis (for queue system)

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and set:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `NEXTAUTH_URL`: http://localhost:3000 (for development)
   - `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `EMAIL_FROM`: Your email sender address
   - `EMAIL_SERVER`: SMTP server details
   - `REDIS_URL`: Redis connection string (default: redis://localhost:6379)

3. **Set up the database:**
   ```bash
   # Run migrations
   npx prisma migrate dev
   
   # Seed development data (optional)
   npm run db:seed
   ```

4. **Start Redis:**
   ```bash
   # In a separate terminal
   redis-server
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

   The application will be available at http://localhost:3000

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
gsthive-app/
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

## Tech Stack

- **Frontend:** Next.js 14, React, TypeScript, Tailwind CSS
- **Backend:** tRPC, Prisma, PostgreSQL
- **Queue:** BullMQ with Redis
- **Authentication:** NextAuth.js
- **Testing:** Vitest, Playwright
- **Charts:** Recharts
- **PDF:** React PDF

## License

MIT