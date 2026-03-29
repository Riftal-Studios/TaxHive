/**
 * LedgerService - Core double-entry accounting service
 *
 * Provides journal entry creation with balance validation,
 * account balance queries with snapshot+delta optimization,
 * and closed period protection.
 */

import { TRPCError } from '@trpc/server'
import { Prisma, JournalEntryStatus, JournalEntryType, PeriodStatus } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { getCurrentFiscalYear } from '@/lib/invoice-utils'

const Decimal = Prisma.Decimal

export interface LedgerLine {
  accountCode: string
  debitAmount: number
  creditAmount: number
  currency?: string
  foreignDebit?: number
  foreignCredit?: number
  exchangeRate?: number
  description: string
  reference?: string
  metadata?: Record<string, unknown>
}

export interface CreateJournalEntryInput {
  userId: string
  entryDate: Date
  entryType: JournalEntryType
  description: string
  sourceType?: string
  sourceId?: string
  lines: LedgerLine[]
  notes?: string
  autoPost?: boolean
}

/**
 * Validate that total debits equal total credits.
 * Throws TRPCError if unbalanced.
 */
export function validateBalance(lines: LedgerLine[]): void {
  const totalDebit = lines.reduce((sum, line) => sum + line.debitAmount, 0)
  const totalCredit = lines.reduce((sum, line) => sum + line.creditAmount, 0)

  // Use epsilon for floating point comparison (0.01 = 1 paisa)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Journal entry is unbalanced: debits=${totalDebit.toFixed(2)}, credits=${totalCredit.toFixed(2)}, difference=${Math.abs(totalDebit - totalCredit).toFixed(2)}`,
    })
  }
}

/**
 * Generate the next journal entry number for a user in a fiscal year.
 */
async function getNextEntryNumber(
  prisma: PrismaClient,
  userId: string,
  fiscalYear: string
): Promise<string> {
  const prefix = `JE/${fiscalYear}/`

  const lastEntry = await prisma.journalEntry.findFirst({
    where: {
      userId,
      entryNumber: { startsWith: prefix },
    },
    orderBy: { entryNumber: 'desc' },
    select: { entryNumber: true },
  })

  let nextSeq = 1
  if (lastEntry) {
    const parts = lastEntry.entryNumber.split('/')
    const lastSeq = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1
    }
  }

  return `${prefix}${nextSeq.toString().padStart(4, '0')}`
}

/**
 * Get fiscal period (YYYY-MM) from a date.
 */
function getFiscalPeriod(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Resolve account codes to account IDs for a user.
 */
async function resolveAccountIds(
  prisma: PrismaClient,
  userId: string,
  accountCodes: string[]
): Promise<Map<string, string>> {
  const accounts = await prisma.gLAccount.findMany({
    where: {
      userId,
      accountCode: { in: accountCodes },
      isActive: true,
    },
    select: { id: true, accountCode: true },
  })

  const map = new Map<string, string>()
  for (const account of accounts) {
    map.set(account.accountCode, account.id)
  }

  // Check all codes were resolved
  for (const code of accountCodes) {
    if (!map.has(code)) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `GL account with code '${code}' not found for user. Ensure chart of accounts is initialized.`,
      })
    }
  }

  return map
}

/**
 * Check if a period is closed and prevent entries if so.
 */
async function preventClosedPeriodEntry(
  prisma: PrismaClient,
  userId: string,
  period: string
): Promise<void> {
  const accountingPeriod = await prisma.accountingPeriod.findUnique({
    where: {
      userId_period: { userId, period },
    },
  })

  if (accountingPeriod && accountingPeriod.status === PeriodStatus.CLOSED) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot create journal entry in closed period ${period}. Reopen the period first.`,
    })
  }
}

/**
 * Create a journal entry with balanced debit/credit lines.
 */
export async function createJournalEntry(
  prisma: PrismaClient,
  input: CreateJournalEntryInput
): Promise<{ id: string; entryNumber: string }> {
  // 1. Validate balance
  validateBalance(input.lines)

  const fiscalYear = getCurrentFiscalYear(input.entryDate)
  const fiscalPeriod = getFiscalPeriod(input.entryDate)

  // 2. Check closed period
  await preventClosedPeriodEntry(prisma, input.userId, fiscalPeriod)

  // 3. Resolve account codes to IDs
  const accountCodes = [...new Set(input.lines.map(l => l.accountCode))]
  const accountIdMap = await resolveAccountIds(prisma, input.userId, accountCodes)

  // 4. Generate entry number
  const entryNumber = await getNextEntryNumber(prisma, input.userId, fiscalYear)

  // 5. Create journal entry with lines
  const entry = await prisma.journalEntry.create({
    data: {
      userId: input.userId,
      entryNumber,
      entryDate: input.entryDate,
      entryType: input.entryType,
      description: input.description,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      fiscalPeriod,
      fiscalYear,
      status: input.autoPost ? JournalEntryStatus.POSTED : JournalEntryStatus.DRAFT,
      postedAt: input.autoPost ? new Date() : null,
      createdBy: input.userId,
      notes: input.notes,
      lines: {
        create: input.lines.map(line => ({
          accountId: accountIdMap.get(line.accountCode)!,
          debitAmount: new Decimal(line.debitAmount),
          creditAmount: new Decimal(line.creditAmount),
          currency: line.currency,
          foreignDebit: line.foreignDebit ? new Decimal(line.foreignDebit) : null,
          foreignCredit: line.foreignCredit ? new Decimal(line.foreignCredit) : null,
          exchangeRate: line.exchangeRate ? new Decimal(line.exchangeRate) : null,
          description: line.description,
          reference: line.reference,
          metadata: line.metadata ? (line.metadata as Record<string, unknown>) : undefined,
        })),
      },
    },
  })

  return { id: entry.id, entryNumber: entry.entryNumber }
}

/**
 * Get the balance for a specific GL account.
 * Uses snapshot+delta optimization: finds last closed period snapshot
 * and only sums entries since that point.
 */
export async function getAccountBalance(
  prisma: PrismaClient,
  userId: string,
  accountCode: string,
  asOfDate?: Date
): Promise<{ debitTotal: number; creditTotal: number; balance: number }> {
  // Resolve account
  const account = await prisma.gLAccount.findUnique({
    where: {
      userId_accountCode: { userId, accountCode },
    },
  })

  if (!account) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Account ${accountCode} not found`,
    })
  }

  // Find last closed period before asOfDate for snapshot
  let snapshotBalance = 0
  let queryFromDate: Date | undefined

  const lastClosedPeriod = await prisma.accountingPeriod.findFirst({
    where: {
      userId,
      status: PeriodStatus.CLOSED,
      ...(asOfDate && { endDate: { lte: asOfDate } }),
    },
    orderBy: { endDate: 'desc' },
  })

  if (lastClosedPeriod?.closingBalance) {
    const closingBalances = lastClosedPeriod.closingBalance as Record<string, number>
    if (closingBalances[accountCode] !== undefined) {
      snapshotBalance = closingBalances[accountCode]
      queryFromDate = lastClosedPeriod.endDate
    }
  }

  // Query entries since snapshot (or all if no snapshot)
  const where: Prisma.LedgerEntryWhereInput = {
    accountId: account.id,
    journalEntry: {
      userId,
      status: JournalEntryStatus.POSTED,
      ...(queryFromDate && { entryDate: { gt: queryFromDate } }),
      ...(asOfDate && !queryFromDate && { entryDate: { lte: asOfDate } }),
      ...(asOfDate && queryFromDate && {
        entryDate: { gt: queryFromDate, lte: asOfDate },
      }),
    },
  }

  const aggregation = await prisma.ledgerEntry.aggregate({
    where,
    _sum: {
      debitAmount: true,
      creditAmount: true,
    },
  })

  const debitDelta = Number(aggregation._sum.debitAmount || 0)
  const creditDelta = Number(aggregation._sum.creditAmount || 0)

  // For ASSET and EXPENSE accounts, normal balance is debit (positive)
  // For LIABILITY, EQUITY, and REVENUE accounts, normal balance is credit (positive)
  const netBalance = snapshotBalance + debitDelta - creditDelta

  return {
    debitTotal: debitDelta,
    creditTotal: creditDelta,
    balance: netBalance,
  }
}

/**
 * Reverse a journal entry by creating a new entry with opposite debits/credits.
 */
export async function reverseJournalEntry(
  prisma: PrismaClient,
  userId: string,
  journalEntryId: string,
  reason: string
): Promise<{ id: string; entryNumber: string }> {
  const original = await prisma.journalEntry.findFirst({
    where: { id: journalEntryId, userId },
    include: { lines: { include: { account: true } } },
  })

  if (!original) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Journal entry not found',
    })
  }

  if (original.status !== JournalEntryStatus.POSTED) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Can only reverse posted journal entries',
    })
  }

  const reversalLines: LedgerLine[] = original.lines.map(line => ({
    accountCode: line.account.accountCode,
    debitAmount: Number(line.creditAmount),
    creditAmount: Number(line.debitAmount),
    currency: line.currency ?? undefined,
    foreignDebit: line.foreignCredit ? Number(line.foreignCredit) : undefined,
    foreignCredit: line.foreignDebit ? Number(line.foreignDebit) : undefined,
    exchangeRate: line.exchangeRate ? Number(line.exchangeRate) : undefined,
    description: `Reversal: ${line.description}`,
    reference: line.reference ?? undefined,
  }))

  const reversal = await createJournalEntry(prisma, {
    userId,
    entryDate: new Date(),
    entryType: original.entryType,
    description: `Reversal of ${original.entryNumber}: ${reason}`,
    sourceType: original.sourceType ?? undefined,
    sourceId: original.sourceId ?? undefined,
    lines: reversalLines,
    notes: reason,
    autoPost: true,
  })

  // Mark original as reversed
  await prisma.journalEntry.update({
    where: { id: journalEntryId },
    data: {
      status: JournalEntryStatus.REVERSED,
      reversedAt: new Date(),
    },
  })

  // Link reversal to original
  await prisma.journalEntry.update({
    where: { id: reversal.id },
    data: { reversalOfId: journalEntryId },
  })

  return reversal
}

/**
 * Reverse all journal entries for a given source.
 */
export async function reverseEntriesBySource(
  prisma: PrismaClient,
  userId: string,
  sourceType: string,
  sourceId: string,
  reason: string
): Promise<void> {
  const entries = await prisma.journalEntry.findMany({
    where: {
      userId,
      sourceType,
      sourceId,
      status: JournalEntryStatus.POSTED,
    },
  })

  for (const entry of entries) {
    await reverseJournalEntry(prisma, userId, entry.id, reason)
  }
}
