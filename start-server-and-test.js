#!/usr/bin/env node

/**
 * Startup script to start the server and test time restrictions
 */

const { spawn } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function startServerAndTest() {
  console.log('🚀 Starting WhatsApp Automation Server and Testing Time Restrictions\n');

  // Start the server
  console.log('1️⃣ Starting server...');
  const server = spawn('node', ['server-supabase.js'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    detached: false
  });

  server.stdout.on('data', (data) => {
    console.log(`[SERVER] ${data.toString().trim()}`);
  });

  server.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR] ${data.toString().trim()}`);
  });

  // Wait for server to start
  console.log('⏳ Waiting for server to start...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test time restrictions
  console.log('\n2️⃣ Testing time restrictions...');
  
  try {
    // Get a user with time restrictions enabled
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, time_restriction_enabled')
      .eq('time_restriction_enabled', true)
      .limit(1);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ No users with time restrictions enabled found');
      console.log('💡 Enable time restrictions for a user in the UserManagement screen');
      return;
    }

    const testUser = users[0];
    console.log(`👤 Testing with user: ${testUser.email}`);

    // Test the API endpoint
    const response = await fetch(`http://localhost:3000/api/time-restrictions/${testUser.id}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Time restrictions API is working!');
      console.log('📊 Response:', JSON.stringify(result, null, 2));
    } else {
      console.log(`⚠️ API responded with status: ${response.status}`);
    }

  } catch (error) {
    console.log('⚠️ Error testing API:', error.message);
  }

  console.log('\n🎉 Server is running!');
  console.log('\n📋 Next steps:');
  console.log('1. Open your mobile app');
  console.log('2. Go to UserManagement screen');
  console.log('3. Enable time restrictions for users');
  console.log('4. Test message sending during restricted hours');
  console.log('\n💡 To stop the server, press Ctrl+C');

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('\n🛑 Stopping server...');
    server.kill();
    process.exit(0);
  });

  // Keep the script running
  await new Promise(() => {});
}

startServerAndTest().catch(console.error);
