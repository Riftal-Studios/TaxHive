import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Uses DATABASE_URL from environment
    // Docker build provides dummy URL, runtime provides real URL
    url: env('DATABASE_URL'),
  },
})
