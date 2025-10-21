import type { Metadata } from "next";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { MarketingFooter } from "@/components/marketing/footer";

/**
 * Marketing Layout - Public pages for unauthenticated users
 *
 * This layout wraps all marketing pages (landing page, features, pricing, blog)
 * Route group: (marketing) - doesn't affect URL structure
 *
 * Structure:
 * - Root layout (app/layout.tsx) provides html, body, providers
 * - Marketing layout (this file) adds navbar and footer
 * - Page content goes in {children}
 *
 * Components:
 * - MarketingNavbar: Sticky navbar with branding and navigation
 * - MarketingFooter: Footer with company info and copyright
 */

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "https://taxhive.app"),
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <MarketingNavbar />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
    </div>
  );
}
