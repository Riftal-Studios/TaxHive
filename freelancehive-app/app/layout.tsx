import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { TRPCReactProvider } from "@/lib/trpc/client"
import { SessionProvider } from "@/components/providers/SessionProvider"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ThemeScript } from "./theme-script"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "FreelanceHive - GST-Compliant Invoice Management",
  description: "Invoice management system for Indian freelancers exporting services with GST compliance",
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
      <body className={inter.className}>
        <SessionProvider session={session}>
          <TRPCReactProvider>{children}</TRPCReactProvider>
        </SessionProvider>
      </body>
    </html>
  )
}