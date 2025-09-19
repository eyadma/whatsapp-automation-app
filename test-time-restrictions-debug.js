#!/usr/bin/env node

/**
 * Debug script for time restrictions feature
 * This script helps debug why time restrictions might not be working
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTimeRestrictions() {
  console.log('🔍 Debugging Time Restrictions Feature\n');

  try {
    // Test 1: Check if database functions exist
    console.log('1️⃣ Testing database functions...');
    
    const { data: functions, error: functionsError } = await supabase
      .rpc('can_send_messages', { user_id: '00000000-0000-0000-0000-000000000000' });

    if (functionsError) {
      console.error('❌ Database functions not working:', functionsError.message);
      console.log('📋 Please run the SQL script: add-time-restrictions.sql');
      return;
    }

    console.log('✅ Database functions are working');

    // Test 2: Check current time in Israel
    console.log('\n2️⃣ Checking current time...');
    const israelTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' });
    const israelTimeOnly = new Date().toLocaleTimeString('en-US', { 
      timeZone: 'Asia/Jerusalem',
      hour12: false 
    });
    
    console.log(`🕐 Current time in Israel: ${israelTime}`);
    console.log(`🕐 Current time (time only): ${israelTimeOnly}`);
    
    // Check if we're in allowed hours
    const currentHour = parseInt(israelTimeOnly.split(':')[0]);
    const currentMinute = parseInt(israelTimeOnly.split(':')[1]);
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    const allowedStartMinutes = 9 * 60; // 09:00
    const allowedEndMinutes = 12 * 60 + 30; // 12:30
    
    console.log(`📊 Current time in minutes: ${currentTimeMinutes}`);
    console.log(`📊 Allowed window: ${allowedStartMinutes} - ${allowedEndMinutes} minutes`);
    console.log(`📊 Within allowed hours: ${currentTimeMinutes >= allowedStartMinutes && currentTimeMinutes <= allowedEndMinutes}`);

    // Test 3: Get a real user and check their restrictions
    console.log('\n3️⃣ Testing with real user...');
    
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, time_restriction_enabled, time_restriction_start, time_restriction_end, time_restriction_timezone, last_message_sent_during_window, daily_usage_tracked')
      .limit(5);

    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ No users found in database');
      return;
    }

    console.log(`📊 Found ${users.length} users`);

    for (const user of users) {
      console.log(`\n👤 User: ${user.email}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Time restriction enabled: ${user.time_restriction_enabled}`);
      console.log(`   Restriction window: ${user.time_restriction_start} - ${user.time_restriction_end}`);
      console.log(`   Timezone: ${user.time_restriction_timezone}`);
      console.log(`   Last message during window: ${user.last_message_sent_during_window}`);
      console.log(`   Daily usage tracked: ${user.daily_usage_tracked}`);

      // Test the functions for this user
      const { data: canSend, error: canSendError } = await supabase
        .rpc('can_send_messages', { user_id: user.id });

      if (canSendError) {
        console.error(`   ❌ Error checking can_send_messages:`, canSendError.message);
      } else {
        console.log(`   📊 Can send messages: ${canSend}`);
      }

      const { data: withinAllowed, error: withinAllowedError } = await supabase
        .rpc('is_within_allowed_hours', { user_id: user.id });

      if (withinAllowedError) {
        console.error(`   ❌ Error checking is_within_allowed_hours:`, withinAllowedError.message);
      } else {
        console.log(`   📊 Within allowed hours: ${withinAllowed}`);
      }

      const { data: usedToday, error: usedTodayError } = await supabase
        .rpc('has_used_messaging_today', { user_id: user.id });

      if (usedTodayError) {
        console.error(`   ❌ Error checking has_used_messaging_today:`, usedTodayError.message);
      } else {
        console.log(`   📊 Used messaging today: ${usedToday}`);
      }
    }

    // Test 4: Check if server is running
    console.log('\n4️⃣ Testing server endpoints...');
    
    try {
      const response = await fetch('http://localhost:3000/api/time-restrictions/' + users[0].id);
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Server is running and time restrictions endpoint is accessible');
        console.log('📊 Server response:', JSON.stringify(result, null, 2));
      } else {
        console.log(`⚠️ Server responded with status: ${response.status}`);
      }
    } catch (error) {
      console.log('⚠️ Server not running or not accessible');
      console.log('💡 Start your server with: node server-supabase.js');
    }

    console.log('\n🎉 Debug completed!');
    console.log('\n📋 Troubleshooting tips:');
    console.log('1. If functions don\'t work: Run add-time-restrictions.sql in Supabase');
    console.log('2. If server not running: Start with "node server-supabase.js"');
    console.log('3. If time restrictions not enabled: Enable them in UserManagement screen');
    console.log('4. If still not working: Check server logs for error messages');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Run the debug
debugTimeRestrictions();
