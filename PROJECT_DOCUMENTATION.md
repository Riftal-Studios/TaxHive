# GSTHive - Comprehensive Project Documentation

## Executive Summary

GSTHive is a modern, GST-compliant invoice management system specifically designed for Indian businesses exporting services internationally. The platform automates the complex requirements of zero-rated supplies under Letter of Undertaking (LUT) with 0% IGST taxation, ensuring full compliance with Indian GST regulations while providing a seamless user experience for service exporters.

### Business Context

Indian service exporters face unique challenges:
- Complex GST compliance requirements for export invoices
- Need for LUT management and declaration on invoices
- Daily exchange rate tracking as per RBI reference rates
- FIRC (Foreign Inward Remittance Certificate) documentation
- Multi-currency payment reconciliation
- Strict invoice formatting requirements under GST Rule 46

GSTHive addresses these challenges by providing an automated, compliant, and user-friendly solution that reduces manual effort and ensures regulatory compliance.

## Technical Architecture

### Tech Stack Overview

#### Frontend
- **Framework**: Next.js 14 with React 19
- **Architecture**: React Server Components (RSC) first approach
- **Styling**: Material-UI v7 + Tailwind CSS for hybrid styling
- **State Management**: TanStack Query (React Query) for server state
- **Type Safety**: TypeScript throughout with strict mode
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for analytics and dashboards

#### Backend
- **API Layer**: tRPC v11 for end-to-end type-safe APIs
- **Database**: PostgreSQL 16 with Prisma ORM v6
- **Authentication**: NextAuth.js v4 with JWT strategy
- **Queue System**: BullMQ with Redis for async jobs
- **PDF Generation**: Puppeteer for server-side PDF rendering
- **Email Service**: Nodemailer with SMTP integration
- **File Storage**: AWS S3 compatible storage (configurable)

#### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for local development
- **Deployment**: Fly.io/Railway/VPS deployment ready
- **Reverse Proxy**: Nginx for production
- **Process Management**: PM2 for Node.js processes
- **Monitoring**: Health checks and status endpoints

#### Development Tools
- **Testing**: Vitest (unit), Playwright (E2E)
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier with Tailwind plugin
- **Git Hooks**: Husky for pre-commit checks
- **Database Management**: Prisma Studio, migrations

## Core Features

### 1. User Management & Authentication

#### Multi-Factor Authentication System
- **Email/Password**: Traditional credentials with bcrypt hashing
- **Magic Links**: Passwordless authentication via email
- **OTP Verification**: 6-digit codes for signup and password reset
- **Session Management**: JWT-based sessions with secure httpOnly cookies

#### User Onboarding Flow
Progressive onboarding with 5 steps:
1. **Profile Setup**: GSTIN, PAN, business address
2. **Client Creation**: First international client
3. **LUT Configuration**: Active LUT details
4. **First Invoice**: Guided invoice creation
5. **Completion**: Dashboard access

### 2. Client Management

#### Client Data Model
```typescript
interface Client {
  name: string
  email: string
  company?: string
  address: string
  country: string
  phone?: string
  taxId?: string  // Foreign tax ID
  isActive: boolean
}
```

#### Features
- CRUD operations with soft delete
- Search and filter capabilities
- Client activity tracking
- Invoice history per client
- Bulk import/export (planned)

### 3. Invoice Management

#### Invoice Lifecycle
```
DRAFT → SENT → PARTIALLY_PAID → PAID
         ↓
      OVERDUE → CANCELLED
```

#### GST-Compliant Invoice Fields
- **Sequential Numbering**: Format `FY{YY-YY}/{NUMBER}` (e.g., FY24-25/001)
- **HSN/SAC Codes**: 8-digit service codes for exports
- **Place of Supply**: Always "Outside India (Section 2-6)"
- **LUT Declaration**: Automatic insertion of LUT details
- **0% IGST**: Zero-rated supply declaration

#### Advanced Features
- **Multi-currency Support**: USD, EUR, GBP, AED, SGD, etc.
- **Exchange Rate Integration**: 
  - Daily RBI reference rate fetching
  - Fallback to ExchangeRatesAPI
  - Historical rate storage
- **Line Items**: Multiple services per invoice
- **Payment Terms**: Customizable payment conditions
- **Bank Details**: Multiple bank account support

### 4. PDF Generation System

#### Asynchronous Generation Pipeline
```
User Request → Queue Job → PDF Generation → S3 Upload → Status Update
```

#### PDF Features
- **Template Engine**: React-based PDF templates
- **Branding**: Company logo and colors
- **Compliance**: All GST Rule 46 requirements
- **Watermarks**: DRAFT/PAID/CANCELLED status
- **Digital Signatures**: Support for DSC (planned)

#### Status Tracking
- Real-time generation status (pending → generating → completed/failed)
- Progress indicators in UI
- Retry mechanism for failures
- Automatic cleanup of old PDFs

### 5. Payment Tracking

#### Payment Reconciliation Flow
```
Client Payment (Y) → Platform Fees → Amount Before Fees (Z) 
→ Bank Credit (INR) → FIRC Documentation
```

#### Features
- **Multi-payment Support**: Partial payments tracking
- **Platform Fee Calculation**: Automatic fee deduction
- **Exchange Rate Tracking**: Actual vs invoice rates
- **FIRC Management**: 
  - Document upload
  - FIRC number tracking
  - Compliance reporting
- **Payment Methods**: Wire transfer, PayPal, Wise, etc.

### 6. LUT Management

#### LUT (Letter of Undertaking) Features
- **Validity Tracking**: Start and end dates
- **Auto-expiry Alerts**: Email notifications before expiry
- **Multiple LUTs**: Historical LUT records
- **Invoice Association**: Link invoices to active LUT
- **Compliance Text**: Automatic LUT declaration on invoices

### 7. Exchange Rate Management

#### RBI Integration
- **Daily Cron Job**: Fetches rates at 2 PM IST
- **Rate Sources**:
  1. Primary: RBI Reference Rates
  2. Fallback: ExchangeRatesAPI
  3. Manual: User override option
- **Historical Data**: Complete rate history
- **Invoice Locking**: Rates frozen at invoice creation

### 8. Email Notifications

#### Automated Email Triggers
- **Invoice Sending**: PDF attachment with cover letter
- **Payment Reminders**: Configurable reminder schedule
- **LUT Expiry**: 30, 15, 7 days before expiry
- **Payment Confirmation**: Receipt generation
- **Monthly Statements**: Automated reconciliation

#### Email Templates
- Responsive HTML templates
- Customizable branding
- Multi-language support (planned)
- Tracking pixels for open rates

### 9. Analytics & Reporting

#### Dashboard Metrics
- **Revenue Analytics**: Monthly, quarterly, yearly
- **Client Insights**: Top clients, payment patterns
- **Currency Analysis**: Exchange rate impact
- **Aging Reports**: Outstanding invoice aging
- **GST Returns**: GSTR-1 preparation data

#### Export Formats
- Excel reports for accounting
- CSV for data import/export
- PDF statements for clients
- JSON API for integrations

### 10. Queue System Architecture

#### Job Types
```typescript
type QueueJobs = 
  | 'PDF_GENERATION'
  | 'EMAIL_NOTIFICATION'
  | 'EXCHANGE_RATE_FETCH'
  | 'PAYMENT_REMINDER'
  | 'LUT_EXPIRY_CHECK'
  | 'REPORT_GENERATION'
```

#### Queue Features
- **Priority Queues**: Critical vs background jobs
- **Retry Logic**: Exponential backoff
- **Job Monitoring**: Dashboard for queue health
- **Error Handling**: Dead letter queue for failures
- **Concurrency Control**: Rate limiting

## Database Schema

### Core Entities

#### User Model
- Authentication credentials
- Business information (GSTIN, PAN)
- Onboarding status tracking
- Multi-tenancy support

#### Invoice Model
- GST compliance fields
- Multi-currency support
- Payment tracking
- PDF generation status
- Public access tokens

#### Relationships
```
User ─┬─> Clients ──> Invoices
      ├─> LUTs ─────> Invoices
      └─> Invoices ─> LineItems
                   └─> Payments
```

## GST Compliance

### Rule 46 Compliance
Every invoice includes mandatory fields:
1. Supplier name, address, and GSTIN
2. Sequential invoice number
3. Date of issue
4. Recipient details
5. HSN/SAC code (8 digits for exports)
6. Description of services
7. Total value and currency
8. Exchange rate and INR equivalent
9. Place of supply declaration
10. 0% IGST with reason
11. LUT number and date
12. Authorized signatory

### Export Documentation
- **Zero-rated Supply**: Clear declaration for exports
- **LUT Bond**: Reference on every invoice
- **FIRC Tracking**: Payment realization proof
- **GST Returns**: Data export for GSTR-1

## Infrastructure & Deployment

### Docker Architecture

#### Multi-Container Setup
```yaml
services:
  - postgres    # Database
  - redis       # Queue backend
  - app         # Next.js application
  - worker      # Queue processor
  - nginx       # Reverse proxy (production)
```

#### Environment Management
- Development: `.env.local`
- Staging: `.env.staging`
- Production: Docker secrets

### Deployment Strategies

#### Local Development
```bash
npm run dev:all  # Starts all services
```

#### Docker Deployment
```bash
./scripts/deploy/deploy-local-docker.sh
```

#### Production Deployment
- Zero-downtime deployments
- Database migrations with safety checks
- Automated backups
- Health monitoring

### Scaling Considerations
- Horizontal scaling for app servers
- Read replicas for database
- Redis clustering for queues
- CDN for static assets
- S3 for PDF storage

## Security Implementation

### Authentication & Authorization
- **Password Security**: Bcrypt with salt rounds
- **Session Management**: Secure JWT with rotation
- **CSRF Protection**: Token validation
- **Rate Limiting**: Brute force protection

### Data Protection
- **Encryption at Rest**: Database encryption
- **Encryption in Transit**: TLS 1.3
- **PII Handling**: GDPR compliance
- **Audit Logging**: Complete activity trail

### API Security
- **Input Validation**: Zod schemas
- **SQL Injection**: Prevented by Prisma
- **XSS Protection**: React's built-in escaping
- **CORS**: Configured origins only

### Compliance
- **OWASP Top 10**: Security controls implemented
- **PCI DSS**: Payment data handling (planned)
- **ISO 27001**: Security framework alignment
- **SOC 2**: Audit readiness

## Development Workflow

### Test-Driven Development (TDD)
```
1. Write failing test
2. Implement minimum code
3. Refactor for quality
4. Repeat
```

### Git Workflow
- Feature branches from `main`
- PR reviews required
- CI/CD pipeline validation
- Semantic versioning

### Code Quality
- TypeScript strict mode
- ESLint enforcement
- Prettier formatting
- Husky pre-commit hooks

### Testing Strategy
- **Unit Tests**: 80% coverage target
- **Integration Tests**: API endpoints
- **E2E Tests**: Critical user flows
- **Compliance Tests**: GST requirements

## Performance Optimization

### Frontend Performance
- **Server Components**: Reduced client bundle
- **Code Splitting**: Route-based chunks
- **Image Optimization**: Next.js Image component
- **Caching**: Aggressive cache headers

### Backend Performance
- **Database Indexing**: Optimized queries
- **Query Optimization**: N+1 prevention
- **Connection Pooling**: PgBouncer ready
- **Queue Processing**: Parallel job execution

### Metrics
- **Core Web Vitals**: LCP < 2.5s, FID < 100ms
- **API Response**: < 200ms p95
- **PDF Generation**: < 5s for complex invoices
- **Uptime Target**: 99.9% availability

## Project Management

### Linear Integration
- **Project**: GSTHive (ID: a24ea5e3-d99d-4587-9917-faf885bf83cd)
- **Team**: UOL
- **Issues**: 40+ tracked features
- **Sprints**: 2-week cycles

### Feature Areas
1. Queue/Job System ✅
2. LUT Management UI
3. Payment Tracking
4. GST Reports
5. Email Notifications
6. Security Compliance
7. Analytics & Reporting
8. Multi-currency Support
9. Client Portal
10. Infrastructure Monitoring

## Future Roadmap

### Q1 2025
- [ ] Client portal for invoice access
- [ ] Automated payment reconciliation
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)

### Q2 2025
- [ ] Multi-user support with roles
- [ ] Expense tracking module
- [ ] GST return filing integration
- [ ] WhatsApp notifications

### Q3 2025
- [ ] AI-powered insights
- [ ] Blockchain invoicing
- [ ] Multi-language support
- [ ] White-label solution

### Q4 2025
- [ ] Marketplace integrations
- [ ] Banking API connections
- [ ] Automated bookkeeping
- [ ] Franchise model

## Support & Documentation

### Resources
- Technical documentation: `/docs`
- API documentation: tRPC panel
- User guides: In-app help
- Video tutorials: YouTube (planned)

### Contact
- Technical support: Email system
- Feature requests: Linear board
- Security issues: Private disclosure
- Community: Discord (planned)

## Conclusion

GSTHive represents a comprehensive solution for Indian service exporters, combining regulatory compliance with modern user experience. The platform's architecture ensures scalability, security, and maintainability while providing the flexibility to adapt to changing business requirements and regulatory updates.

The system's success lies in its attention to GST compliance details, automation of complex workflows, and focus on user experience, making it an essential tool for businesses engaged in international service exports from India.

---

*Last Updated: December 2024*
*Version: 1.0.0*