#!/usr/bin/env node

/**
 * Setup script for Supabase Edge Functions
 * 
 * This script helps configure and deploy edge functions for the Anti-Gravity Timetable System.
 * 
 * Usage:
 *   npm run setup:edge-functions
 */

import { execSync } from 'child_process';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('🚀 Supabase Edge Functions Setup\n');
  
  // Check if Supabase CLI is installed
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    console.log('✅ Supabase CLI is installed\n');
  } catch (error) {
    console.error('❌ Supabase CLI is not installed');
    console.log('Install it with: npm install -g supabase');
    process.exit(1);
  }
  
  // Get project details
  console.log('Please provide your Supabase project details:\n');
  
  const projectRef = await question('Project Reference ID: ');
  const supabaseUrl = await question('Supabase URL (https://xxx.supabase.co): ');
  const serviceRoleKey = await question('Service Role Key: ');
  const anonKey = await question('Anon Key: ');
  const telegramBotToken = await question('Telegram Bot Token: ');
  
  console.log('\n📝 Creating .env file...');
  
  const envContent = `SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}
SUPABASE_ANON_KEY=${anonKey}
TELEGRAM_BOT_TOKEN=${telegramBotToken}
`;
  
  const fs = require('fs');
  const path = require('path');
  
  fs.writeFileSync(
    path.join(__dirname, '../supabase/functions/.env'),
    envContent
  );
  
  console.log('✅ .env file created\n');
  
  // Link project
  console.log('🔗 Linking to Supabase project...');
  try {
    execSync(`supabase link --project-ref ${projectRef}`, { 
      stdio: 'inherit',
      cwd: path.join(__dirname, '../supabase')
    });
    console.log('✅ Project linked\n');
  } catch (error) {
    console.error('❌ Failed to link project');
    process.exit(1);
  }
  
  // Set secrets
  console.log('🔐 Setting secrets...');
  try {
    execSync(`supabase secrets set TELEGRAM_BOT_TOKEN="${telegramBotToken}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../supabase')
    });
    execSync(`supabase secrets set SUPABASE_SERVICE_ROLE_KEY="${serviceRoleKey}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../supabase')
    });
    console.log('✅ Secrets set\n');
  } catch (error) {
    console.error('❌ Failed to set secrets');
    process.exit(1);
  }
  
  // Deploy functions
  const deploy = await question('Deploy functions now? (y/n): ');
  
  if (deploy.toLowerCase() === 'y') {
    console.log('\n🚀 Deploying edge functions...\n');
    
    const functions = [
      'notify-timetable-change',
      'process-substitution-request',
      'handle-database-webhook',
      'check-expired-requests',
    ];
    
    for (const func of functions) {
      console.log(`Deploying ${func}...`);
      try {
        execSync(`supabase functions deploy ${func}`, {
          stdio: 'inherit',
          cwd: path.join(__dirname, '../supabase')
        });
        console.log(`✅ ${func} deployed\n`);
      } catch (error) {
        console.error(`❌ Failed to deploy ${func}`);
      }
    }
  }
  
  // Configure webhooks
  console.log('\n📡 Webhook Configuration\n');
  console.log('Please configure the following webhooks in your Supabase Dashboard:\n');
  console.log('1. For periods table:');
  console.log(`   URL: ${supabaseUrl}/functions/v1/handle-database-webhook`);
  console.log('   Events: INSERT, UPDATE, DELETE');
  console.log('   Table: periods');
  console.log('   Schema: public\n');
  
  console.log('2. For substitution_requests table:');
  console.log(`   URL: ${supabaseUrl}/functions/v1/handle-database-webhook`);
  console.log('   Events: INSERT, UPDATE');
  console.log('   Table: substitution_requests');
  console.log('   Schema: public\n');
  
  console.log('⏰ Cron Job Configuration\n');
  console.log('Set up a cron job to call check-expired-requests every 5 minutes:');
  console.log(`curl -X POST ${supabaseUrl}/functions/v1/check-expired-requests`);
  console.log('Schedule: */5 * * * *\n');
  
  console.log('✅ Setup complete!\n');
  console.log('Next steps:');
  console.log('1. Configure webhooks in Supabase Dashboard');
  console.log('2. Set up cron job for expired requests');
  console.log('3. Test the functions with sample data\n');
  
  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
