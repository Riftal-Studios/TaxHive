# Security Guidelines for GSTHive

## Overview

This document outlines the security measures implemented in GSTHive and provides guidelines for maintaining security best practices.

## Security Measures Implemented

### 1. Environment and Secrets Management

- **Never commit secrets to version control**
- Use `.env.example` files as templates
- Store actual secrets in:
  - `.env.local` for local development
  - Docker secrets for production
  - Environment variables in deployment

### 2. Authentication & Authorization

- NextAuth.js with JWT sessions
- Email-based authentication (magic links)
- Session validation on protected routes
- User-specific data isolation

### 3. API Security

#### Rate Limiting
- Upload API: 10 uploads per minute per user
- Cron endpoints: 5 calls per 5-minute window per IP
- Implement Redis-based rate limiting for production

#### Input Validation
- File upload validation (type, size, content)
- Magic number/signature verification for uploaded files
- Filename sanitization to prevent directory traversal
- Size limits (5MB for uploads)

#### Secure Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` for camera, microphone, geolocation

### 4. File Upload Security

- Authentication required for all uploads
- File type validation (both MIME type and file extension)
- Content validation using magic numbers
- Filename sanitization
- User-isolated upload directories
- Rate limiting per user

### 5. Database Security

- Prisma ORM with parameterized queries (prevents SQL injection)
- User data isolation
- Connection string security via environment variables

### 6. Logging Security

- No secrets logged in production
- Sanitized error messages
- Aggregated logging for security events

## Security Best Practices for Developers

### 1. Environment Variables

```bash
# ❌ Don't do this
NEXTAUTH_SECRET=hardcoded-secret-123

# ✅ Do this
NEXTAUTH_SECRET=your-secure-random-secret-here
```

### 2. File Handling

```typescript
// ❌ Don't do this
const filename = userInput

// ✅ Do this
const filename = sanitizeFilename(userInput)
```

### 3. API Endpoints

```typescript
// ❌ Don't do this
export async function GET(request: NextRequest) {
  // No authentication check
}

// ✅ Do this
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

### 4. Error Handling

```typescript
// ❌ Don't do this
catch (error) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}

// ✅ Do this
catch (error) {
  console.error('Operation failed:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

## Security Checklist for Deployments

### Pre-deployment

- [ ] All secrets removed from code
- [ ] Environment variables properly configured
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] File upload restrictions in place
- [ ] Authentication on all protected routes

### Production

- [ ] Use strong, unique secrets
- [ ] Enable HTTPS only
- [ ] Configure proper CORS
- [ ] Monitor for security events
- [ ] Regular dependency updates
- [ ] Database backups encrypted

### Monitoring

- [ ] Failed authentication attempts
- [ ] Rate limit violations
- [ ] Unusual file uploads
- [ ] Error patterns
- [ ] Performance anomalies

## Dependency Security

- Run `npm audit` regularly
- Update dependencies promptly
- Review security advisories
- Use `PUPPETEER_SKIP_DOWNLOAD=true` in environments where not needed

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do not** create a public issue
2. Contact the development team privately
3. Provide detailed information about the vulnerability
4. Allow time for the team to address the issue

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security Documentation](https://nextjs.org/docs/advanced-features/security-headers)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)