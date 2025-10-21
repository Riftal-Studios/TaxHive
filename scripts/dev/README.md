# Development Scripts

## create-demo-user.ts

Creates a comprehensive demo user account with realistic test data for the TaxHive application.

### Usage

```bash
# Create demo user with test data
npx tsx scripts/dev/create-demo-user.ts

# Create demo user with cleanup (removes existing demo user first)
npx tsx scripts/dev/create-demo-user.ts --clean
```

### Prerequisites

- Database must be running and accessible
- Environment variables must be configured (`.env.local` or `.env`)
- Prisma client must be generated (`npm run generate`)

### Demo User Credentials

- **Email**: `demo@taxhive.app`
- **Password**: `Demo123!`

### Generated Test Data

The script creates comprehensive, realistic test data including:

#### User Profile
- Name: Rajesh Kumar
- GSTIN: 29ABCDE1234F1Z5 (Karnataka)
- PAN: ABCDE1234F
- Complete Indian business address
- Onboarding completed

#### Clients (9 total)
- 3 US clients (USD currency)
- 2 UK clients (GBP currency)
- 2 EU clients (EUR currency - Germany, France)
- 1 Canadian client (CAD currency)
- 1 Australian client (AUD currency)

Each client includes:
- Realistic company name and contact person
- Complete international address
- Foreign tax ID
- Currency based on country

#### LUT Records (2 total)
- 1 Active LUT for FY 2024-25
- 1 Expired LUT for FY 2023-24

#### Exchange Rates (6 currencies)
- USD, EUR, GBP, CAD, AUD, SGD
- Realistic rates from "RBI" source
- Current date effective

#### Invoices (18 total)
Distribution by status:
- 2 DRAFT invoices
- 5 SENT unpaid invoices
- 6 PAID invoices
- 3 PARTIALLY_PAID invoices
- 2 OVERDUE invoices

Each invoice includes:
- Unique invoice number (FY24-25/001, FY24-25/002, etc.)
- 2-4 line items with realistic service descriptions
- Proper HSN/SAC codes (998314, 998315, 998316)
- Foreign currency amounts and INR calculations
- Exchange rate from RBI
- Payment terms (Net 30 or Net 45 days)
- Bank details
- Realistic dates based on status

#### Payments
- Payment records for all PAID and PARTIALLY_PAID invoices
- Realistic payment methods (Wire Transfer, PayPal, Wise, Bank Transfer)
- Platform fees calculation (2-3%)
- Exchange rate variations
- Bank charges in INR (200-500)
- FIRC numbers and dates
- FIRC document URLs

#### Email History (10-15 entries)
- Invoice sent emails
- Payment reminder emails (for overdue invoices)
- Payment received confirmations
- Mix of SENT and FAILED statuses
- Proper message IDs and templates

### Script Features

- **Idempotent**: Can be run multiple times safely
- **Cleanup Option**: `--clean` flag removes existing demo user data first
- **Detailed Logging**: Progress indicators and summary statistics
- **Error Handling**: Proper error messages with rollback
- **Realistic Data**: Uses faker.js for varied, realistic test data
- **Proper Relations**: All foreign keys properly linked
- **Date Logic**: Invoices have appropriate dates based on their status

### Example Output

```
🚀 Creating comprehensive demo user with test data

Demo User Credentials:
  Email: demo@taxhive.app
  Password: Demo123!

🧹 Cleaning up existing demo user data...
   Found existing demo user: clxxxxx
   Deleted 10 email history entries
   Deleted 8 payments
   Deleted 72 invoice items
   Deleted 18 invoices
   Deleted 9 clients
   Deleted 2 LUT records
   Deleted demo user
✅ Cleanup completed

👤 Creating demo user...
   Created user: demo@taxhive.app (ID: clxxxxx)
🏢 Creating international clients...
   Created 9 clients
📋 Creating LUT records...
   Created 2 LUT records
💱 Creating exchange rates...
   Created 6 exchange rates
📄 Creating invoices with line items...
   Created 18 invoices with line items
💰 Creating payment records...
   Created 8 payment records
📧 Creating email history entries...
   Created 16 email history entries

============================================================
✅ Demo user creation completed successfully!

Summary:
  👤 User: demo@taxhive.app
  🏢 Clients: 9
  📋 LUT Records: 2
  💱 Exchange Rates: 6
  📄 Invoices: 18
  💰 Payments: 8
  📧 Email History: 16

============================================================

You can now log in with:
  Email: demo@taxhive.app
  Password: Demo123!

To run again with cleanup:
  tsx scripts/dev/create-demo-user.ts --clean
============================================================
```

### Troubleshooting

**Database Connection Error**
```
Can't reach database server at `localhost:5432`
```
**Solution**: Start your database server or check your DATABASE_URL in `.env.local`

**Module Not Found**
```
Command 'tsx' not found
```
**Solution**: Use `npx tsx` instead or install tsx globally with `npm install -g tsx`

**Platform Mismatch (esbuild)**
```
Error: You installed esbuild for another platform
```
**Solution**: Run `npm rebuild esbuild` to rebuild for your current platform
