import type { Metadata } from "next"
import "./globals.css"
import "@/styles/autofill-dark-mode.css"
import { TRPCReactProvider } from "@/lib/trpc/client"
import { SessionProvider } from "@/components/providers/SessionProvider"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ThemeProvider } from "@/components/theme-provider"
import { ErrorBoundary } from '@/components/error-boundary'

export const metadata: Metadata = {
  title: "GSTHive - GST-Compliant Invoice Management",
  description: "Invoice management system for Indian businesses exporting services with GST compliance",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession(authOptions)
  
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider session={session}>
          <TRPCReactProvider>
            <ThemeProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </ThemeProvider>
          </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  )
}