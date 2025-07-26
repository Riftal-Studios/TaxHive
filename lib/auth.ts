// Load Docker secrets before configuring auth
import '@/server/secrets-loader'

import { NextAuthOptions } from 'next-auth'
import EmailProvider from 'next-auth/providers/email'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { sendVerificationRequest } from './email/sendVerificationRequest'
import { sendVerificationRequestConsole } from './email/consoleEmail'

const nextAuthUrl = process.env.NEXTAUTH_URL
const nextAuthSecret = process.env.NEXTAUTH_SECRET

console.log('NextAuth Configuration:')
console.log('  NEXTAUTH_URL:', nextAuthUrl)
console.log('  NEXTAUTH_SECRET:', nextAuthSecret ? '[SET]' : '[NOT SET]')

if (!nextAuthUrl) {
  console.error('CRITICAL: NEXTAUTH_URL is not set, authentication will not work correctly')
}

if (!nextAuthSecret) {
  console.error('CRITICAL: NEXTAUTH_SECRET is not set, JWT signing will fail')
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  providers: [
    EmailProvider({
      server: process.env.AWS_SES_SMTP_USER && process.env.AWS_SES_SMTP_PASSWORD ? {
        host: `email-smtp.${process.env.AWS_SES_REGION || 'us-east-1'}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: process.env.AWS_SES_SMTP_USER,
          pass: process.env.AWS_SES_SMTP_PASSWORD
        }
      } : {
        host: "localhost",
        port: 25,
        auth: {
          user: "",
          pass: ""
        }
      },
      from: process.env.EMAIL_FROM || 'GSTHive <noreply@gsthive.com>',
      sendVerificationRequest: process.env.AWS_SES_SMTP_USER ? sendVerificationRequest : sendVerificationRequestConsole,
      maxAge: 24 * 60 * 60, // 24 hours
    }),
  ],
  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },
  callbacks: {
    async signIn({ user }) {
      // Log successful sign in
      console.log('User signing in:', user.email)
      return true
    },
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id as string
        session.user.name = token.name
        session.user.email = token.email
      }

      return session
    },
    async jwt({ token, user }) {
      // If user is defined, this is the initial sign in
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }

      // Always try to get the latest user data from database
      if (token.email) {
        const dbUser = await prisma.user.findFirst({
          where: {
            email: token.email,
          },
        })

        if (dbUser) {
          token.id = dbUser.id
          token.name = dbUser.name
          token.email = dbUser.email
          token.onboardingCompleted = dbUser.onboardingCompleted
          token.onboardingStep = dbUser.onboardingStep
        }
      }

      return token
    },
  },
}