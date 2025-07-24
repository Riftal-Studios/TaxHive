#!/usr/bin/env node

/**
 * Script to resolve failed migrations in production database
 * This marks the failed migration as rolled back so new migrations can be applied
 */

import { execSync } from 'child_process';

const DATABASE_DB_URL = process.env.DATABASE_DB_URL;
const DATABASE_DIRECT_URL = process.env.DATABASE_DIRECT_URL;

if (!DATABASE_DB_URL || !DATABASE_DIRECT_URL) {
  console.error('❌ Missing required environment variables: DATABASE_DB_URL and DATABASE_DIRECT_URL');
  process.exit(1);
}

console.log('🔍 Checking migration status...');

try {
  // First, let's check the current migration status
  console.log('\n📊 Current migration status:');
  execSync('npx prisma migrate status', { stdio: 'inherit' });
} catch (error) {
  console.log('⚠️  Migration status check failed, continuing...');
}

console.log('\n🔧 Resolving failed migration: 20250716172554_init');

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
  
  console.log('✅ Successfully marked migration as rolled back');
  
  // Now check status again
  console.log('\n📊 Updated migration status:');
  execSync('npx prisma migrate status', { stdio: 'inherit' });
  
  console.log('\n✅ Failed migration resolved! You can now apply new migrations.');
  
} catch (error) {
  console.error('❌ Failed to resolve migration:', error);
  process.exit(1);
}