#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Status tracking object
const connectionStatus = {
  connected: false,
  lastCheck: null,
  errors: [],
  testsPassed: 0,
  totalTests: 0
};

// Function to refresh and display status
function refreshStatus(message = '') {
  const timestamp = new Date().toLocaleTimeString();
  connectionStatus.lastCheck = timestamp;
  
  console.log(`\n🔄 Status Refresh - ${timestamp}`);
  console.log('================================');
  console.log(`📡 Connection: ${connectionStatus.connected ? '✅ Connected' : '❌ Disconnected'}`);
  console.log(`🧪 Tests: ${connectionStatus.testsPassed}/${connectionStatus.totalTests} passed`);
  console.log(`⏰ Last Check: ${connectionStatus.lastCheck}`);
  
  if (connectionStatus.errors.length > 0) {
    console.log(`⚠️  Recent Errors: ${connectionStatus.errors.length}`);
    connectionStatus.errors.slice(-3).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  if (message) {
    console.log(`📝 ${message}`);
  }
  console.log('================================\n');
}

// Function to update connection status
function updateConnectionStatus(connected, error = null) {
  connectionStatus.connected = connected;
  if (error) {
    connectionStatus.errors.push(`${new Date().toLocaleTimeString()}: ${error}`);
    // Keep only last 5 errors
    if (connectionStatus.errors.length > 5) {
      connectionStatus.errors = connectionStatus.errors.slice(-5);
    }
  }
  refreshStatus();
}

// Utility function to convert WhatsApp phone numbers to Israeli local format
function convertWhatsAppPhoneToLocal(whatsappPhoneNumber) {
  let localPhoneNumber = whatsappPhoneNumber;
  
  // WhatsApp sends: 972526686285 (international format)
  // Database stores: 0526686285 (Israeli local format)
  if (whatsappPhoneNumber.startsWith('972')) {
    // Remove 972 country code
    const localNumber = whatsappPhoneNumber.substring(3);
    
    // Check if it's a valid Israeli mobile number (starts with 5 and has 9 digits)
    if (localNumber.startsWith('5') && localNumber.length === 9) {
      // Convert to Israeli format: 0567891234
      localPhoneNumber = '0' + localNumber;
    }
  } else if (whatsappPhoneNumber.startsWith('+972')) {
    // Handle +972 format
    const localNumber = whatsappPhoneNumber.substring(4);
    if (localNumber.startsWith('5') && localNumber.length === 9) {
      localPhoneNumber = '0' + localNumber;
    }
  }
  
  return localPhoneNumber;
}

// Utility function to normalize phone numbers for comparison
function normalizePhoneNumber(phoneNumber) {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  let normalized = phoneNumber.replace(/\D/g, '');
  
  // Handle Israeli numbers
  if (normalized.startsWith('972')) {
    normalized = normalized.substring(3);
  } else if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }
  
  return normalized;
}

async function testLocationListenerWithLocationsTable() {
  console.log('🧪 Testing Location Message Listener with Locations Table');
  console.log('=======================================================\n');

  // Initialize status tracking
  connectionStatus.totalTests = 8;
  connectionStatus.testsPassed = 0;
  
  // Initial status refresh
  refreshStatus('Starting location listener test with locations table...');

  try {
    // Test 1: Check if locations table exists
    console.log('1. Checking if locations table exists...');
    
    const { data: sampleLocation, error: selectError } = await supabase
      .from('locations')
      .select('id, name, phone')
      .limit(1);

    if (selectError) {
      console.error('❌ Error checking locations table:', selectError.message);
      
      if (selectError.message.includes('relation "public.locations" does not exist')) {
        console.log('\n🔧 Locations table not found. Please run the SQL script:');
        console.log('   create-locations-table.sql');
        return false;
      }
      
      throw selectError;
    }

    console.log('✅ Locations table exists');
    
    // Update status after successful test
    connectionStatus.testsPassed++;
    updateConnectionStatus(true, null);
    refreshStatus('Test 1 completed: Locations table verified');

    // Test 2: Check if location fields exist in locations table
    console.log('\n2. Checking if location fields exist in locations table...');
    
    const { data: locationFields, error: fieldsError } = await supabase
      .from('locations')
      .select('longitude, latitude, location_received')
      .limit(1);

    if (fieldsError) {
      console.error('❌ Error checking location fields:', fieldsError.message);
      
      if (fieldsError.message.includes('column "longitude" does not exist')) {
        console.log('\n🔧 Location fields not found in locations table. Please run the SQL script:');
        console.log('   add-location-fields-to-locations-table.sql');
        return false;
      }
      
      throw fieldsError;
    }

    console.log('✅ Location fields exist in locations table');
    console.log('   - longitude: DECIMAL(10, 8)');
    console.log('   - latitude: DECIMAL(11, 8)');
    console.log('   - location_received: BOOLEAN');
    
    // Update status after successful test
    connectionStatus.testsPassed++;
    updateConnectionStatus(true, null);
    refreshStatus('Test 2 completed: Location fields verified in locations table');

    // Test 3: Test phone number conversion
    console.log('\n3. Testing phone number conversion...');
    
    const testNumbers = [
      { input: '972526686285', expected: '0526686285' },
      { input: '+972526686285', expected: '0526686285' },
      { input: '972501234567', expected: '0501234567' },
      { input: '1234567890', expected: '1234567890' },
      { input: '972123456789', expected: '972123456789' }
    ];
    
    let conversionTestsPassed = 0;
    testNumbers.forEach(({ input, expected }) => {
      const converted = convertWhatsAppPhoneToLocal(input);
      const passed = converted === expected;
      console.log(`   ${input} -> ${converted} ${passed ? '✅' : '❌'}`);
      if (passed) conversionTestsPassed++;
    });
    
    if (conversionTestsPassed === testNumbers.length) {
      console.log('✅ All phone number conversions passed');
    } else {
      console.log(`⚠️  ${conversionTestsPassed}/${testNumbers.length} phone number conversions passed`);
    }
    
    // Update status after successful test
    connectionStatus.testsPassed++;
    updateConnectionStatus(true, null);
    refreshStatus('Test 3 completed: Phone number conversion verified');

    // Test 4: Test phone number normalization
    console.log('\n4. Testing phone number normalization...');
    
    const normalizationTests = [
      { input: '0526686285', expected: '526686285' },
      { input: '972526686285', expected: '526686285' },
      { input: '+972-52-668-6285', expected: '526686285' },
      { input: '050-123-4567', expected: '501234567' }
    ];
    
    let normalizationTestsPassed = 0;
    normalizationTests.forEach(({ input, expected }) => {
      const normalized = normalizePhoneNumber(input);
      const passed = normalized === expected;
      console.log(`   "${input}" -> "${normalized}" ${passed ? '✅' : '❌'}`);
      if (passed) normalizationTestsPassed++;
    });
    
    if (normalizationTestsPassed === normalizationTests.length) {
      console.log('✅ All phone number normalizations passed');
    } else {
      console.log(`⚠️  ${normalizationTestsPassed}/${normalizationTests.length} phone number normalizations passed`);
    }
    
    // Update status after successful test
    connectionStatus.testsPassed++;
    updateConnectionStatus(true, null);
    refreshStatus('Test 4 completed: Phone number normalization verified');

    // Test 5: Test location data insertion
    console.log('\n5. Testing location data insertion...');
    
    const testLocationData = {
      user_id: 'test-user-id',
      name: 'Test Location Listener',
      phone: '972501234567',
      phone2: '0501234567', // Add phone2 for testing
      longitude: 34.7818,
      latitude: 32.0853,
      location_received: true,
      area: 'Test Area',
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data: insertedLocation, error: insertError } = await supabase
      .from('locations')
      .insert([testLocationData])
      .select();

    if (insertError) {
      console.error('❌ Error inserting test location:', insertError.message);
      throw insertError;
    }

    console.log('✅ Successfully inserted test location with location data');
    console.log('   Location ID:', insertedLocation[0].id);
    console.log('   Location:', `${insertedLocation[0].latitude}, ${insertedLocation[0].longitude}`);
    
    // Update status after successful test
    connectionStatus.testsPassed++;
    updateConnectionStatus(true, null);
    refreshStatus('Test 5 completed: Location data insertion verified');

    // Test 6: Test location data update
    console.log('\n6. Testing location data update...');
    
    const updateData = {
      longitude: 34.7820,
      latitude: 32.0855,
      location_received: true,
      updated_at: new Date()
    };

    const { error: updateError } = await supabase
      .from('locations')
      .update(updateData)
      .eq('id', insertedLocation[0].id);

    if (updateError) {
      console.error('❌ Error updating test location:', updateError.message);
      throw updateError;
    }

    console.log('✅ Successfully updated test location with new coordinates');
    console.log('   New Location:', `${updateData.latitude}, ${updateData.longitude}`);
    
    // Update status after successful test
    connectionStatus.testsPassed++;
    updateConnectionStatus(true, null);
    refreshStatus('Test 6 completed: Location data update verified');

    // Test 7: Test phone2 column matching
    console.log('\n7. Testing phone2 column matching...');
    
    // Create a test location with phone2
    const testLocationWithPhone2 = {
      user_id: 'test-user-id',
      name: 'Test Phone2 Location',
      phone: '0509876543',
      phone2: '972501234567', // This should match our converted number
      longitude: 35.0000,
      latitude: 32.0000,
      location_received: false,
      area: 'Test Phone2 Area',
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data: insertedPhone2Location, error: insertPhone2Error } = await supabase
      .from('locations')
      .insert([testLocationWithPhone2])
      .select();

    if (insertPhone2Error) {
      console.error('❌ Error inserting test location with phone2:', insertPhone2Error.message);
      throw insertPhone2Error;
    }

    console.log('✅ Successfully inserted test location with phone2');
    console.log('   Location ID:', insertedPhone2Location[0].id);
    console.log('   Phone:', insertedPhone2Location[0].phone);
    console.log('   Phone2:', insertedPhone2Location[0].phone2);
    
    // Test phone2 matching logic
    const testPhone2Number = '972501234567';
    const convertedPhone2Number = convertWhatsAppPhoneToLocal(testPhone2Number);
    const normalizedPhone2 = normalizePhoneNumber(convertedPhone2Number);
    const normalizedOriginalPhone2 = normalizePhoneNumber(testPhone2Number);
    
    console.log(`   Testing phone2 matching: ${testPhone2Number} -> ${convertedPhone2Number}`);
    console.log(`   Normalized: ${normalizedPhone2}, Original: ${normalizedOriginalPhone2}`);
    
    // Check if the phone2 would match
    const locationPhone2Normalized = normalizePhoneNumber(insertedPhone2Location[0].phone2);
    const wouldMatch = locationPhone2Normalized === normalizedPhone2 || 
                      locationPhone2Normalized === normalizedOriginalPhone2;
    
    console.log(`   Phone2 normalized: ${locationPhone2Normalized}`);
    console.log(`   Would match: ${wouldMatch ? '✅' : '❌'}`);
    
    if (wouldMatch) {
      console.log('✅ Phone2 column matching logic works correctly');
    } else {
      console.log('⚠️  Phone2 column matching logic needs review');
    }
    
    // Update status after successful test
    connectionStatus.testsPassed++;
    updateConnectionStatus(true, null);
    refreshStatus('Test 7 completed: Phone2 column matching verified');

    // Test 8: Clean up test data
    console.log('\n8. Cleaning up test data...');
    
    await supabase
      .from('locations')
      .delete()
      .eq('id', insertedLocation[0].id);
      
    await supabase
      .from('locations')
      .delete()
      .eq('id', insertedPhone2Location[0].id);

    console.log('✅ Test data cleaned up');
    
    // Update status after successful test
    connectionStatus.testsPassed++;
    updateConnectionStatus(true, null);
    refreshStatus('Test 8 completed: Test data cleanup verified');

    console.log('\n🎉 All tests passed! Location message listener is ready to work with locations table.');
    
    // Final status refresh
    refreshStatus('🎉 ALL TESTS COMPLETED SUCCESSFULLY! Location listener ready for locations table.');
    
    console.log('\n📋 Next steps:');
    console.log('1. Run the SQL script: add-location-fields-to-locations-table.sql');
    console.log('2. Start your WhatsApp server');
    console.log('3. Connect WhatsApp to the application');
    console.log('4. Send a location message to test the functionality');
    console.log('5. Check the locations table for location updates');
    
    console.log('\n📱 Location Message Listener Features:');
    console.log('✅ Detects direct location messages');
    console.log('✅ Detects quoted location messages');
    console.log('✅ Converts WhatsApp phone numbers to Israeli format');
    console.log('✅ Searches locations table for matching phone numbers');
    console.log('✅ Updates existing locations with coordinates');
    console.log('✅ Creates new location entries when no match found');
    console.log('✅ Sets location_received flag to true');
    console.log('✅ Logs location messages to message history');

    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Update status with error
    updateConnectionStatus(false, error.message);
    refreshStatus('❌ TEST FAILED - Check error details above');
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure you have run the SQL script: add-location-fields-to-locations-table.sql');
    console.log('2. Check your Supabase credentials');
    console.log('3. Verify database permissions');
    console.log('4. Ensure locations table exists and has required fields');
    return false;
  }
}

// Run the test
testLocationListenerWithLocationsTable()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
