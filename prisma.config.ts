import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Use process.env directly to allow prisma generate without DATABASE_URL
    // (required for Docker builds where DB connection isn't needed)
    url: process.env.DATABASE_URL ?? '',
  },
})
