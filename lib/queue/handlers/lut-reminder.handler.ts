import type { Job, LutReminderJobData } from '../types'
import type { LUT, User } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email/service'
import { daysUntilLUTExpiry } from '@/lib/lut-utils'

type LUTWithUser = LUT & { user: User | null }

interface LutReminderResult {
  success: boolean
  mode: string
  lutsFound: number
  remindersSent: number
  errors: Array<{ lutId: string; error: string }>
}

/**
 * Handler for LUT reminder jobs
 * Supports three modes:
 * - 'scan': Find all expiring LUTs (within 30 days) and send first reminders
 * - 'single': Send reminder for a specific LUT
 * - 'renewal_scan': Find LUTs expiring within 7 days and send renewal reminders
 */
export async function lutReminderHandler(job: Job<LutReminderJobData>): Promise<LutReminderResult> {
  const { mode, lutId } = job.data
  const errors: Array<{ lutId: string; error: string }> = []
  let remindersSent = 0

  // Build query based on mode
  let luts: LUTWithUser[]

  if (mode === 'single') {
    if (!lutId) {
      return {
        success: false,
        mode,
        lutsFound: 0,
        remindersSent: 0,
        errors: [{ lutId: 'unknown', error: 'lutId is required for single mode' }],
      }
    }

    luts = await prisma.lUT.findMany({
      where: { id: lutId },
      include: { user: true },
    })

    if (luts.length === 0) {
      return {
        success: false,
        mode,
        lutsFound: 0,
        remindersSent: 0,
        errors: [{ lutId, error: 'LUT not found' }],
      }
    }
  } else if (mode === 'scan') {
    // Find active LUTs expiring in 1-30 days that haven't had a reminder sent
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    luts = await prisma.lUT.findMany({
      where: {
        isActive: true,
        reminderSentAt: null,
        validTill: {
          gte: now, // Not already expired
          lte: thirtyDaysFromNow, // Expires within 30 days
        },
      },
      include: { user: true },
    })
  } else if (mode === 'renewal_scan') {
    // Find active LUTs expiring in 1-7 days that have had first reminder but not renewal
    const now = new Date()
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(now.getDate() + 7)

    luts = await prisma.lUT.findMany({
      where: {
        isActive: true,
        reminderSentAt: { not: null }, // First reminder already sent
        renewalReminderSentAt: null,
        validTill: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: { user: true },
    })
  } else {
    return {
      success: false,
      mode,
      lutsFound: 0,
      remindersSent: 0,
      errors: [{ lutId: 'unknown', error: `Invalid mode: ${mode}` }],
    }
  }

  // Process each LUT
  for (const lut of luts) {
    const user = lut.user
    if (!user || !user.email) {
      errors.push({ lutId: lut.id, error: 'User or email not found' })
      continue
    }

    try {
      const daysRemaining = daysUntilLUTExpiry(lut)
      const templateName: 'lut-renewal-reminder' | 'lut-expiry-reminder' =
        mode === 'renewal_scan' ? 'lut-renewal-reminder' : 'lut-expiry-reminder'

      await sendEmail({
        to: user.email,
        subject: mode === 'renewal_scan'
          ? `Urgent: Your LUT ${lut.lutNumber} expires in ${daysRemaining} days`
          : `Reminder: Your LUT ${lut.lutNumber} expires in ${daysRemaining} days`,
        template: templateName,
        data: {
          userName: user.name || 'User',
          lutNumber: lut.lutNumber,
          validTill: lut.validTill.toISOString().split('T')[0],
          daysRemaining,
          renewalUrl: `${process.env.NEXT_PUBLIC_APP_URL}/luts/renew?lutId=${lut.id}`,
        },
      })

      // Mark reminder as sent
      const updateField = mode === 'renewal_scan' ? 'renewalReminderSentAt' : 'reminderSentAt'
      await prisma.lUT.update({
        where: { id: lut.id },
        data: { [updateField]: new Date() },
      })

      remindersSent++
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      errors.push({ lutId: lut.id, error: errorMessage })
    }
  }

  return {
    success: true,
    mode,
    lutsFound: luts.length,
    remindersSent,
    errors,
  }
}
