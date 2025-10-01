# GitHub Workflows

## Branch Strategy

- **main** (default branch) - All development happens here, deploys to staging
- **prod** - Production branch, only receives PRs from main

## Workflow Overview

### 1. test.yml
- **Triggers**: Push to any branch except main/prod, PRs to main
- **Purpose**: Run tests, linting, and type checking
- **When**: On feature branches and PRs before merging to main

### 2. staging.yml
- **Triggers**: Push to main branch
- **Purpose**: Build and deploy to staging environment
- **URL**: https://staging.taxhive.app
- **When**: After code is merged to main
- **Uses**: deploy-common.yml for deployment logic

### 3. production.yml
- **Triggers**: Push to prod branch
- **Purpose**: Build and deploy to production environment
- **URL**: https://taxhive.app
- **When**: After PR from main is merged to prod
- **Uses**: deploy-common.yml for deployment logic

### 4. deploy-common.yml
- **Triggers**: Called by staging.yml and production.yml
- **Purpose**: Reusable deployment workflow with:
  - Secrets management
  - Database migrations (with proper error handling)
  - Health checks (internal and external)
  - Container deployment
  - Cleanup tasks
- **When**: Used by other workflows

### 5. promote-to-production.yml
- **Triggers**: Manual workflow dispatch from main branch
- **Purpose**: Create PR from main to prod for production deployment
- **When**: When staging is tested and ready for production

### 6. rollback.yml
- **Triggers**: Manual workflow dispatch
- **Purpose**: Rollback to a previous deployment
- **When**: If issues are found in production

## Development Flow

1. Create feature branch from main
2. Make changes and push
3. Tests run automatically on feature branch (test.yml)
4. Create PR to main
5. Tests run on PR (test.yml)
6. Merge to main
7. Staging deployment runs automatically (staging.yml)
8. Test on staging environment
9. Run promote-to-production workflow to create PR to prod
10. Review and merge PR to prod
11. Production deployment runs automatically (production.yml)

## Important Notes

- Never push directly to prod
- All changes must go through main (staging) first
- Staging deployments happen automatically when merging to main
- Production deployments happen automatically when merging to prod
- Use rollback.yml if you need to revert production