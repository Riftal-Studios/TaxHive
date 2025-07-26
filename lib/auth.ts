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
  trustHost: true, // Trust the Host header when behind proxy
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
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      console.log('Sign in event:', { user: user.email, account: account?.provider, isNewUser })
    },
    async signOut({ session, token }) {
      console.log('Sign out event:', { user: session?.user?.email || token?.email })
    },
    async createUser({ user }) {
      console.log('User created:', { user: user.email })
    },
    async linkAccount({ user, account, profile }) {
      console.log('Account linked:', { user: user.email, provider: account.provider })
    },
    async session({ session, token }) {
      // Log session access (can be noisy, uncomment if needed for debugging)
      // console.log('Session accessed:', { user: session.user.email })
    },
  },
  callbacks: {
    async signIn({ user }) {
      try {
        // Log successful sign in
        console.log('User signing in:', user.email)
        return true
      } catch (error) {
        console.error('Sign in callback error:', error)
        // Return true to allow sign in to continue even if logging fails
        return true
      }
    },
    async session({ token, session }) {
      try {
        if (token) {
          session.user.id = token.id as string
          session.user.name = token.name
          session.user.email = token.email
        }

        return session
      } catch (error) {
        console.error('Session callback error:', error)
        // Return session as-is to prevent breaking the auth flow
        return session
      }
    },
    async jwt({ token, user }) {
      try {
        // If user is defined, this is the initial sign in
        if (user) {
          token.id = user.id
          token.email = user.email
          token.name = user.name
        }

        // Try to get the latest user data from database
        if (token.email) {
          try {
            const dbUser = await prisma.user.findFirst({
              where: {
                email: token.email,
              },
            })

            if (dbUser) {
              token.id = dbUser.id
              token.name = dbUser.name
              token.email = dbUser.email
            }
          } catch (dbError) {
            console.error('Database error in JWT callback:', dbError)
            // Continue with existing token data if database query fails
          }
        }

        return token
      } catch (error) {
        console.error('JWT callback error:', error)
        // Return token as-is to prevent breaking the auth flow
        return token
      }
    },
  },
}