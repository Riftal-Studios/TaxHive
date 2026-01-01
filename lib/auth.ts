// Load Docker secrets before configuring auth
import "@/server/secrets-loader";

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { verifyPassword } from "./auth/password";

const nextAuthUrl = process.env.NEXTAUTH_URL;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

// Only warn about NEXTAUTH_URL in production - in development it auto-detects from request headers
if (!nextAuthUrl && process.env.NODE_ENV === "production") {
  console.error(
    "CRITICAL: NEXTAUTH_URL is not set, authentication will not work correctly in production",
  );
}

if (!nextAuthSecret) {
  console.error("CRITICAL: NEXTAUTH_SECRET is not set, JWT signing will fail");
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter email and password");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          select: {
            id: true,
            email: true,
            password: true,
            name: true,
            emailVerified: true,
            role: true,
          },
        });

        if (!user) {
          throw new Error("No user found with this email");
        }

        if (!user.emailVerified) {
          throw new Error("Please verify your email first");
        }

        if (!user.password) {
          throw new Error("Account not found. Please sign up first");
        }

        const isValid = await verifyPassword(
          credentials.password,
          user.password,
        );

        if (!isValid) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
    signOut: "/", // Redirect to home page after logout
    error: "/auth/error",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Handle invalid or malformed URLs gracefully
      try {
        // If url is a relative path, prepend baseUrl
        if (url.startsWith("/")) {
          return `${baseUrl}${url}`;
        }

        // Skip URLs that contain encoded quotes or are clearly malformed
        // These are typically from bots or malformed requests
        if (url.includes("%22") || url.includes("%27") || url.includes("/_next/")) {
          console.warn("Rejected malformed callback URL:", url);
          return baseUrl;
        }

        // Parse the URL and check if it's on the same origin
        const parsedUrl = new URL(url);
        if (parsedUrl.origin === baseUrl) {
          return url;
        }
      } catch {
        // If URL parsing fails, log and return safe default
        console.warn("Failed to parse callback URL:", url);
      }

      // Default to baseUrl (home page) for any invalid or external URLs
      return baseUrl;
    },
    async signIn() {
      return true;
    },
    async session({ token, session }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.name = token.name;
        session.user.email = token.email;
        session.user.role = token.role;
        session.user.onboardingCompleted = token.onboardingCompleted;
        session.user.onboardingStep = token.onboardingStep;
      }

      return session;
    },
    async jwt({ token, user, trigger }) {
      // If user is defined, this is the initial sign in
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token.role = (user as any).role;
      }

      // Only fetch fresh user data on sign in or when explicitly updating the session
      // This prevents database queries on every request
      if ((user || trigger === "update") && token.email) {
        const dbUser = await prisma.user.findFirst({
          where: {
            email: token.email,
          },
        });

        if (dbUser) {
          token.id = dbUser.id;
          token.name = dbUser.name;
          token.email = dbUser.email;
          token.role = dbUser.role;
          token.onboardingCompleted = dbUser.onboardingCompleted;
          token.onboardingStep = dbUser.onboardingStep;
        }
      }

      return token;
    },
  },
};
