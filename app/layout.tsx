import type { Metadata } from "next"
import "./globals.css"
import "@/styles/autofill-dark-mode.css"
import { TRPCReactProvider } from "@/lib/trpc/client"
import { SessionProvider } from "@/components/providers/SessionProvider"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeScript } from "./theme-script"

// Force dynamic rendering for all pages since we use session
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: "TaxHive - GST-Compliant Invoice Management",
  description: "Invoice management system for Indian businesses exporting services with GST compliance",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/logo-light.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await getServerSession(authOptions)
  
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body suppressHydrationWarning>
        <SessionProvider session={session}>
          <TRPCReactProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  )
}