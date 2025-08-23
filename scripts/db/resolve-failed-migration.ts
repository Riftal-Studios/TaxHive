#!/usr/bin/env node

/**
 * Script to resolve failed migrations in production database
 * This marks the failed migration as rolled back so new migrations can be applied
 */

import { Logger } from '../../lib/logger';
import { execSync } from 'child_process';

const DATABASE_DB_URL = process.env.DATABASE_DB_URL;
const DATABASE_DIRECT_URL = process.env.DATABASE_DIRECT_URL;

if (!DATABASE_DB_URL || !DATABASE_DIRECT_URL) {
  Logger.error('❌ Missing required environment variables: DATABASE_DB_URL and DATABASE_DIRECT_URL');
  process.exit(1);
}

Logger.info('🔍 Checking migration status...');

try {
  // First, let's check the current migration status
  Logger.info('\n📊 Current migration status:');
  execSync('npx prisma migrate status', { stdio: 'inherit' });
} catch (error) {
  Logger.info('⚠️  Migration status check failed, continuing...');
}

Logger.info('\n🔧 Resolving failed migration: 20250716172554_init');

try {
  // Mark the failed migration as rolled back
  execSync('npx prisma migrate resolve --rolled-back 20250716172554_init', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_DB_URL,
      DATABASE_DIRECT_URL
    }
  });
  
  Logger.info('✅ Successfully marked migration as rolled back');
  
  // Now check status again
  Logger.info('\n📊 Updated migration status:');
  execSync('npx prisma migrate status', { stdio: 'inherit' });
  
  Logger.info('\n✅ Failed migration resolved! You can now apply new migrations.');
  
} catch (error) {
  Logger.error('❌ Failed to resolve migration:', error);
  process.exit(1);
}