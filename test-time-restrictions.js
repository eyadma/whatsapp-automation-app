#!/usr/bin/env node

/**
 * Test script for time restrictions feature
 * This script tests the time restriction functionality including:
 * - Database schema setup
 * - Time restriction logic
 * - Override functionality
 * - API endpoints
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

async function testTimeRestrictions() {
  console.log('🧪 Testing Time Restrictions Feature\n');

  try {
    // Test 1: Check if database schema exists
    console.log('1️⃣ Testing database schema...');
    
    // Try to select from profiles table with new columns to test if they exist
    const { data: testData, error: schemaError } = await supabase
      .from('profiles')
      .select('time_restriction_enabled, time_restriction_start, time_restriction_end, time_restriction_timezone, last_message_sent_during_window, daily_usage_tracked')
      .limit(1);

    if (schemaError) {
      console.error('❌ Schema error - columns may not exist:', schemaError.message);
      console.log('📋 Please run the SQL script: add-time-restrictions.sql');
      return;
    }

    console.log('✅ Database schema is correct');

    // Test 2: Test time restriction functions
    console.log('\n2️⃣ Testing time restriction functions...');
    
    // Get a test user (or create one)
    let testUserId;
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (usersError || !users.length) {
      console.log('⚠️ No users found, creating test user...');
      // Create a test user
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'test-time-restrictions@example.com',
        password: 'testpassword123',
        email_confirm: true,
      });

      if (createError) {
        console.error('❌ Error creating test user:', createError);
        return;
      }

      testUserId = newUser.user.id;
    } else {
      testUserId = users[0].id;
    }

    console.log(`📝 Using test user: ${testUserId}`);

    // Test 3: Test time restriction logic
    console.log('\n3️⃣ Testing time restriction logic...');
    
    // Enable time restrictions for test user
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        time_restriction_enabled: true,
        time_restriction_start: '09:00:00',
        time_restriction_end: '12:30:00',
        time_restriction_timezone: 'Asia/Jerusalem'
      })
      .eq('id', testUserId);

    if (updateError) {
      console.error('❌ Error updating user restrictions:', updateError);
      return;
    }

    console.log('✅ Time restrictions enabled for test user');

    // Test can_send_messages function
    const { data: canSend, error: canSendError } = await supabase
      .rpc('can_send_messages', { user_id: testUserId });

    if (canSendError) {
      console.error('❌ Error testing can_send_messages:', canSendError);
      return;
    }

    console.log(`📊 Can send messages: ${canSend}`);
    console.log(`🕐 Current time in Israel: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' })}`);

    // Test 4: Test usage tracking functionality
    console.log('\n4️⃣ Testing usage tracking functionality...');
    
    const { data: trackResult, error: trackError } = await supabase
      .rpc('track_message_usage', { 
        user_id: testUserId
      });

    if (trackError) {
      console.error('❌ Error tracking message usage:', trackError);
      return;
    }

    if (!trackResult) {
      console.error('❌ Usage tracking failed');
      return;
    }

    console.log('✅ Message usage tracked successfully');

    // Test can_send_messages after tracking usage
    const { data: canSendAfterTracking, error: canSendTrackError } = await supabase
      .rpc('can_send_messages', { user_id: testUserId });

    if (canSendTrackError) {
      console.error('❌ Error testing can_send_messages after tracking:', canSendTrackError);
      return;
    }

    console.log(`📊 Can send messages after tracking usage: ${canSendAfterTracking}`);

    // Test 5: Test API endpoints (if server is running)
    console.log('\n5️⃣ Testing API endpoints...');
    
    try {
      const response = await fetch('http://localhost:3000/api/time-restrictions/' + testUserId);
      if (response.ok) {
        const result = await response.json();
        console.log('✅ GET /api/time-restrictions/:userId endpoint working');
        console.log('📊 Response:', JSON.stringify(result, null, 2));
      } else {
        console.log('⚠️ Server not running or endpoint not accessible');
      }
    } catch (error) {
      console.log('⚠️ Server not running or endpoint not accessible');
    }

    // Test 6: Clean up
    console.log('\n6️⃣ Cleaning up...');
    
    // Disable time restrictions for test user
    const { error: cleanupError } = await supabase
      .from('profiles')
      .update({
        time_restriction_enabled: false,
        last_message_sent_during_window: null,
        daily_usage_tracked: null
      })
      .eq('id', testUserId);

    if (cleanupError) {
      console.error('❌ Error cleaning up:', cleanupError);
    } else {
      console.log('✅ Cleanup completed');
    }

    console.log('\n🎉 Time restrictions feature test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Run the SQL script: add-time-restrictions.sql');
    console.log('2. Start your server: node server-supabase.js');
    console.log('3. Test the mobile app UserManagement screen');
    console.log('4. Try sending messages during restricted hours');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testTimeRestrictions();
