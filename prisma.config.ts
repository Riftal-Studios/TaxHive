import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Only include datasource config when DATABASE_URL is available
// This allows prisma generate to work without DATABASE_URL (for Docker builds)
// while still supporting prisma migrate deploy when DATABASE_URL is set
const config = defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(process.env.DATABASE_URL
    ? {
        datasource: {
          url: process.env.DATABASE_URL,
        },
      }
    : {}),
})

export default config
