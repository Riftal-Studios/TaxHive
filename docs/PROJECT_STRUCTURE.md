# Project Structure

This document explains the organization of the GST Hive codebase.

## Directory Layout

```
gsthive/
├── app/                    # Next.js App Router pages
│   ├── (authenticated)/   # Protected routes
│   ├── api/              # API routes
│   └── auth/             # Authentication pages
├── components/            # React components
│   ├── clients/          # Client-related components
│   ├── invoices/         # Invoice components
│   ├── layout/           # Layout components
│   ├── mui/              # Material UI components
│   └── providers/        # Context providers
├── config/               # Deployment configurations
│   ├── fly.toml         # Fly.io config
│   └── vercel.json      # Vercel config
├── docker/              # Docker configurations
│   ├── Dockerfile       # Development Dockerfile
│   ├── Dockerfile.production
│   ├── docker-compose.yml
│   ├── docker-compose.production.yml
│   ├── docker-compose.multi-env.yml
│   └── cloudflare-tunnel-config.yml
├── docs/                # Documentation
│   ├── CLOUDFLARE_SETUP.md            # Single environment setup
│   ├── CLOUDFLARE_MULTI_ENV_SETUP.md  # Production + Staging setup
│   ├── DEPLOYMENT_SUMMARY.md          # Quick deployment reference
│   ├── (env vars documented in .env.example)
│   ├── GITHUB_ENVIRONMENTS_SETUP.md   # GitHub environments & secrets
│   ├── SINGLE_VPS_SETUP.md           # Multi-env on one VPS
│   ├── email-setup.md                 # Email configuration
│   ├── local-setup.md                 # Local development
│   └── queue-system.md                # Queue/jobs documentation
├── lib/                 # Shared libraries
│   ├── auth.ts         # Authentication config
│   ├── email/          # Email service
│   ├── queue/          # Queue system
│   ├── trpc/           # tRPC setup
│   └── validations/    # Validation schemas
├── prisma/             # Database
│   ├── schema.prisma   # Database schema
│   ├── migrations/     # Migration files
│   └── seed.ts        # Seed data
├── public/             # Static assets
├── scripts/            # Utility scripts
│   ├── deploy/         # Deployment scripts
│   │   ├── deploy.sh
│   │   └── VPS_SETUP.sh
│   ├── queue-worker.ts
│   ├── cron-exchange-rates.ts
│   └── seed-test-data.ts
├── server/             # Backend code
│   └── api/           # tRPC routers
├── tests/              # Test files
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── types/              # TypeScript types
└── .github/            # GitHub Actions workflows
    └── workflows/
```

## Root Files

Only essential configuration files remain at the root:

### Core Config
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `next.config.js` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS
- `postcss.config.js` - PostCSS config

### Environment
- `.env.example` - Example environment variables with documentation
- `.gitignore` - Git ignore rules

### Testing
- `playwright.config.ts` - E2E test config
- `vitest.config.ts` - Unit test config

### Documentation
- `README.md` - Project overview
- `CLAUDE.md` - AI assistant instructions

## File Organization Principles

1. **Configuration**: Framework configs stay at root, deployment configs in `/config`
2. **Docker**: All container-related files in `/docker`
3. **Scripts**: Organized by purpose in `/scripts`
4. **Documentation**: All docs in `/docs` except README.md
5. **Source Code**: Follows Next.js conventions

## Quick Access

- **Start locally**: `npm run dev`
- **Deploy**: `./scripts/deploy/deploy.sh`
- **Docker**: `cd docker && docker-compose up`
- **Tests**: `npm test`