import { z } from 'zod'
import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { TRPCError } from '@trpc/server'
import { generateOTP, verifyOTP } from '@/lib/auth/otp'
import { hashPassword, validatePassword } from '@/lib/auth/password'
import { sendOTPEmail } from '@/lib/email/service'
import { prisma } from '@/lib/prisma'

export const authRouter = createTRPCRouter({
  // Send OTP for signup
  sendSignupOTP: publicProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
    }))
    .mutation(async ({ input }) => {
      const { email } = input
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })
      
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account with this email already exists',
        })
      }
      
      // Generate and save OTP
      const otp = await generateOTP(email, 'SIGNUP')
      
      // Send OTP email
      await sendOTPEmail(email, otp.code, 'SIGNUP')
      
      return {
        success: true,
        message: 'Verification code sent to your email',
      }
    }),
  
  // Verify OTP and create account
  signupWithOTP: publicProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
      otp: z.string().length(6, 'OTP must be 6 digits'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      name: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { email, otp, password, name } = input
      
      // Validate password strength
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.errors.join(', '),
        })
      }
      
      // Verify OTP
      try {
        await verifyOTP(email, otp, 'SIGNUP')
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid OTP',
        })
      }
      
      // Check if user already exists (double check)
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })
      
      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account with this email already exists',
        })
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password)
      
      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          emailVerified: new Date(),
          name,
        },
      })
      
      // Clean up used OTP
      await prisma.oTP.deleteMany({
        where: {
          email,
          purpose: 'SIGNUP',
          verified: true,
        },
      })
      
      return {
        success: true,
        message: 'Account created successfully! Please sign in.',
        userId: user.id,
      }
    }),
  
  // Send OTP for password reset
  sendPasswordResetOTP: publicProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
    }))
    .mutation(async ({ input }) => {
      const { email } = input
      
      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { email },
      })
      
      if (!user) {
        // Don't reveal if user exists or not
        return {
          success: true,
          message: 'If an account exists, a verification code will be sent',
        }
      }
      
      // Generate and save OTP
      const otp = await generateOTP(email, 'PASSWORD_RESET', user.id)
      
      // Send OTP email
      await sendOTPEmail(email, otp.code, 'PASSWORD_RESET')
      
      return {
        success: true,
        message: 'If an account exists, a verification code will be sent',
      }
    }),
  
  // Reset password with OTP
  resetPasswordWithOTP: publicProcedure
    .input(z.object({
      email: z.string().email('Invalid email address'),
      otp: z.string().length(6, 'OTP must be 6 digits'),
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    }))
    .mutation(async ({ input }) => {
      const { email, otp, newPassword } = input
      
      // Validate password strength
      const passwordValidation = validatePassword(newPassword)
      if (!passwordValidation.isValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: passwordValidation.errors.join(', '),
        })
      }
      
      // Verify OTP
      let verifiedOTP
      try {
        verifiedOTP = await verifyOTP(email, otp, 'PASSWORD_RESET')
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid OTP',
        })
      }
      
      if (!verifiedOTP.userId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid OTP',
        })
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(newPassword)
      
      // Update user password
      await prisma.user.update({
        where: { id: verifiedOTP.userId },
        data: { password: hashedPassword },
      })
      
      // Clean up used OTP
      await prisma.oTP.deleteMany({
        where: {
          email,
          purpose: 'PASSWORD_RESET',
          verified: true,
        },
      })
      
      return {
        success: true,
        message: 'Password reset successfully! Please sign in with your new password.',
      }
    }),
})