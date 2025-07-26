import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

const OTP_LENGTH = 6
const OTP_EXPIRY_MINUTES = 10
const MAX_ATTEMPTS = 3

export async function generateOTP(email: string, purpose: 'SIGNUP' | 'PASSWORD_RESET', userId?: string) {
  // Delete any existing unverified OTPs for this email and purpose
  await prisma.oTP.deleteMany({
    where: {
      email,
      purpose,
      verified: false,
    },
  })

  // Generate a 6-digit OTP
  const code = crypto.randomInt(100000, 999999).toString()
  
  // Create OTP record
  const otp = await prisma.oTP.create({
    data: {
      email,
      code,
      purpose,
      userId,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    },
  })

  return otp
}

export async function verifyOTP(email: string, code: string, purpose: 'SIGNUP' | 'PASSWORD_RESET') {
  const otp = await prisma.oTP.findFirst({
    where: {
      email,
      code,
      purpose,
      verified: false,
      expiresAt: {
        gt: new Date(),
      },
    },
  })

  if (!otp) {
    // Check if there's an OTP but it's expired
    const expiredOTP = await prisma.oTP.findFirst({
      where: {
        email,
        code,
        purpose,
        verified: false,
      },
    })

    if (expiredOTP) {
      throw new Error('OTP has expired. Please request a new one.')
    }

    throw new Error('Invalid OTP code.')
  }

  // Check attempts
  if (otp.attempts >= MAX_ATTEMPTS) {
    throw new Error('Too many failed attempts. Please request a new OTP.')
  }

  // Increment attempts
  await prisma.oTP.update({
    where: { id: otp.id },
    data: { attempts: otp.attempts + 1 },
  })

  // If code matches, mark as verified
  if (otp.code === code) {
    await prisma.oTP.update({
      where: { id: otp.id },
      data: { verified: true },
    })
    return otp
  }

  throw new Error(`Invalid OTP code. ${MAX_ATTEMPTS - otp.attempts - 1} attempts remaining.`)
}

export async function cleanupExpiredOTPs() {
  // Delete OTPs older than 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  
  await prisma.oTP.deleteMany({
    where: {
      createdAt: {
        lt: oneHourAgo,
      },
    },
  })
}