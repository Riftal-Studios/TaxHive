// Load Docker secrets before configuring auth
import '@/server/secrets-loader'

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from './prisma'
import { verifyPassword } from './auth/password'

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
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password')
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            emailVerified: true,
          }
        })
        
        if (!user) {
          throw new Error('No user found with this email')
        }
        
        if (!user.emailVerified) {
          throw new Error('Please verify your email first')
        }
        
        if (!user.password) {
          throw new Error('Account not found. Please sign up first')
        }
        
        const isValid = await verifyPassword(credentials.password, user.password)
        
        if (!isValid) {
          throw new Error('Invalid password')
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    }),
  ],
  pages: {
    signIn: '/auth/signin',
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
        session.user.onboardingCompleted = token.onboardingCompleted
        session.user.onboardingStep = token.onboardingStep
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
      // This runs on every JWT callback including session updates
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