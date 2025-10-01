# Queue System Implementation

## Overview

The GSTHive queue system is built on BullMQ and Redis to handle asynchronous jobs like PDF generation, email notifications, and exchange rate fetching.

## Architecture

### Components

1. **Queue Service Interface** (`/lib/queue/types.ts`)
   - Defines the contract for queue implementations
   - Supports multiple queue providers (currently BullMQ)

2. **BullMQ Implementation** (`/lib/queue/bullmq.service.ts`)
   - Concrete implementation using BullMQ
   - Handles job enqueueing, processing, and monitoring

3. **Job Handlers** (`/lib/queue/handlers/`)
   - PDF Generation: Generates invoice PDFs asynchronously
   - Email Notifications: Sends invoice emails, payment reminders
   - Exchange Rate Fetch: Fetches daily rates from RBI/fallback APIs

4. **Worker Process** (`/scripts/queue-worker.ts`)
   - Long-running process that consumes jobs from queues
   - Registers all handlers and processes jobs

## Usage

### Starting the Worker

```bash
# Development (with auto-reload)
npm run worker:dev

# Production
npm run worker
```

### API Integration

The invoice router now supports async PDF generation:

```typescript
// Queue PDF generation
const { jobId } = await trpc.invoice.queuePDFGeneration.mutate({ 
  id: invoiceId 
})

// Check status
const status = await trpc.invoice.getPDFGenerationStatus.query({ 
  jobId 
})
```

### Running Exchange Rate Cron

```bash
# Run manually
tsx scripts/cron-exchange-rates.ts

# Or schedule with cron
0 9 * * * cd /path/to/app && tsx scripts/cron-exchange-rates.ts
```

## Job Types

### PDF_GENERATION
- **Data**: `{ invoiceId: string, userId: string }`
- **Result**: `{ success: boolean, pdfUrl: string, invoiceId: string }`
- **Progress**: Updates at 25%, 50%, 75%, 100%

### EMAIL_NOTIFICATION
- **Data**: `{ type: 'invoice' | 'payment_reminder' | 'lut_expiry', ... }`
- **Result**: `{ success: boolean, messageId: string }`

### EXCHANGE_RATE_FETCH
- **Data**: `{ date?: Date, currencies: string[], source: string }`
- **Result**: `{ success: boolean, source: string, ratesFetched: number }`

## Configuration

### Environment Variables

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Docker Setup

Redis is included in the docker-compose configuration:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis-data:/data
```

## Testing

### Unit Tests
- Queue service interface tests
- BullMQ implementation tests
- Individual handler tests

### Integration Tests
- End-to-end job processing
- Queue functionality with Redis

Run tests:
```bash
npm run test tests/unit/queue/
npm run test tests/integration/queue/
```

## Monitoring

Future implementation will include:
- Queue dashboard UI
- Job metrics and statistics
- Failed job management
- Retry configuration

## Best Practices

1. **Idempotency**: Handlers should be idempotent in case of retries
2. **Error Handling**: Proper error handling with meaningful messages
3. **Progress Tracking**: Update job progress for long-running tasks
4. **Cleanup**: Clean old data (e.g., exchange rates > 30 days)
5. **Graceful Shutdown**: Worker handles SIGTERM/SIGINT properly