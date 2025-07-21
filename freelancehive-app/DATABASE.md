# Database Setup

## Development Setup

### Using SQLite (Recommended for quick start)

1. The project is configured to use SQLite for local development by default
2. Run migrations: `npm run db:migrate`
3. Seed the database: `npm run db:seed`
4. View data: `npm run db:studio`

### Using PostgreSQL (Production-like environment)

1. Update `.env` file:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/freelancehive?schema=public"
   ```

2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. Start PostgreSQL with Docker:
   ```bash
   docker-compose up -d postgres
   ```

4. Run migrations:
   ```bash
   npx prisma migrate dev
   ```

## Database Schema

The database includes the following main tables:

- **User**: Stores user accounts with GST details (GSTIN, PAN)
- **Client**: Customer information for invoicing
- **Invoice**: GST-compliant invoices with all required fields
- **InvoiceItem**: Line items for each invoice
- **Payment**: Payment records for invoices
- **LUT**: Letter of Undertaking for 0% GST exports
- **ExchangeRate**: Daily exchange rates from RBI

## GST Compliance

All invoices include mandatory GST fields:
- Place of Supply (for exports: "Outside India (Section 2-6)")
- HSN/SAC codes (8 digits for exports)
- IGST rate (0% for exports under LUT)
- LUT reference
- Exchange rate with source

## Migrations

- Create new migration: `npx prisma migrate dev --name <migration_name>`
- Deploy migrations: `npx prisma migrate deploy`
- Reset database: `npx prisma migrate reset`

## Seeding

The seed script creates:
- Test user with GST details
- Sample clients
- Active LUT
- Sample invoice with line items
- Current exchange rates

Run seed: `npm run db:seed`