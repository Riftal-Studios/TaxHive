import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Prisma client with connection pooling
 *
 * Connection pool settings can be configured via DATABASE_URL:
 * - connection_limit: max connections (default: num_cpus * 2 + 1)
 * - pool_timeout: wait time for connection (default: 10s)
 *
 * Example: postgresql://user:pass@host:5432/db?connection_limit=5&pool_timeout=20
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Alias for consistency with tests
export const db = prisma