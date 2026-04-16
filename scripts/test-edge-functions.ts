#!/usr/bin/env node

/**
 * Test script for Supabase Edge Functions
 * 
 * This script tests all edge functions with sample data.
 * 
 * Usage:
 *   npm run test:edge-functions
 */

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

async function testFunction(
  url: string,
  payload: any,
  headers: Record<string, string> = {}
): Promise<void> {
  console.log(`\n🧪 Testing: ${url}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

async function main() {
  console.log('🧪 Edge Functions Test Suite\n');
  
  const supabaseUrl = await question('Supabase URL (https://xxx.supabase.co): ');
  const anonKey = await question('Anon Key: ');
  
  const headers = {
    'Authorization': `Bearer ${anonKey}`,
  };
  
  // Test 1: notify-timetable-change
  console.log('\n=== Test 1: notify-timetable-change ===');
  const teacherId = await question('Enter a teacher UUID (with Telegram linked): ');
  
  await testFunction(
    `${supabaseUrl}/functions/v1/notify-timetable-change`,
    {
      type: 'INSERT',
      table: 'periods',
      record: {
        id: 'test-period-id',
        teacher_id: teacherId,
        subject: 'Mathematics',
        day_of_week: 1,
        period_number: 3,
        start_time: '09:00',
        end_time: '09:45',
        period_type: 'teaching',
      },
      schema: 'public',
    },
    headers
  );
  
  // Test 2: process-substitution-request
  console.log('\n=== Test 2: process-substitution-request ===');
  const requestId = await question('Enter a substitution request UUID (or skip): ');
  
  if (requestId && requestId.trim()) {
    await testFunction(
      `${supabaseUrl}/functions/v1/process-substitution-request`,
      {
        requestId: requestId.trim(),
      },
      headers
    );
  } else {
    console.log('⏭️  Skipped');
  }
  
  // Test 3: handle-database-webhook
  console.log('\n=== Test 3: handle-database-webhook ===');
  
  await testFunction(
    `${supabaseUrl}/functions/v1/handle-database-webhook`,
    {
      type: 'INSERT',
      table: 'periods',
      record: {
        id: 'test-period-id-2',
        teacher_id: teacherId,
        subject: 'Physics',
        day_of_week: 2,
        period_number: 4,
        start_time: '10:00',
        end_time: '10:45',
        period_type: 'teaching',
      },
      schema: 'public',
    },
    headers
  );
  
  // Test 4: check-expired-requests
  console.log('\n=== Test 4: check-expired-requests ===');
  
  await testFunction(
    `${supabaseUrl}/functions/v1/check-expired-requests`,
    {},
    headers
  );
  
  console.log('\n✅ All tests completed!\n');
  
  rl.close();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
