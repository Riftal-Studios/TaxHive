import { type DefaultSession } from 'next-auth'

type UserRole = 'USER' | 'ADMIN'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role?: UserRole
      onboardingCompleted?: boolean
      onboardingStep?: string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: UserRole
    onboardingCompleted?: boolean
    onboardingStep?: string | null
  }
}