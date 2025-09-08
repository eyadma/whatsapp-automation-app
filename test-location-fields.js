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

// Utility function to convert WhatsApp phone numbers to Israeli local format
function convertWhatsAppPhoneToLocal(whatsappPhoneNumber) {
  let localPhoneNumber = whatsappPhoneNumber;
  
  // WhatsApp sends: 972526686285 (international format)
  // Database stores: 0567891234 (Israeli local format)
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

async function testLocationFields() {
  console.log('🧪 Testing Location Fields in Customers Table');
  console.log('=============================================\n');

  try {
    // Test 1: Check if location fields exist
    console.log('1. Checking if location fields exist...');
    
    const { data: sampleCustomer, error: selectError } = await supabase
      .from('customers')
      .select('longitude, latitude, location_received')
      .limit(1);

    if (selectError) {
      console.error('❌ Error checking location fields:', selectError.message);
      
      if (selectError.message.includes('column "longitude" does not exist')) {
        console.log('\n🔧 Location fields not found. Please run the SQL script:');
        console.log('   add-location-fields-to-customers.sql');
        return false;
      }
      
      throw selectError;
    }

    console.log('✅ Location fields exist in customers table');
    console.log('   - longitude: DECIMAL(10, 8)');
    console.log('   - latitude: DECIMAL(11, 8)');
    console.log('   - location_received: BOOLEAN');

    // Test 2: Check message_history table
    console.log('\n2. Checking message_history table...');
    
    const { data: sampleMessage, error: messageError } = await supabase
      .from('message_history')
      .select('message_type')
      .limit(1);

    if (messageError) {
      console.error('❌ Error checking message_history:', messageError.message);
      
      if (messageError.message.includes('column "message_type" does not exist')) {
        console.log('\n🔧 Message type field not found. Please run the SQL script:');
        console.log('   add-location-fields-to-customers.sql');
        return false;
      }
      
      throw messageError;
    }

    console.log('✅ Message type field exists in message_history table');

    // Test 3: Try to insert a test customer with location data
    console.log('\n3. Testing location data insertion...');
    
    const testCustomerData = {
      user_id: 'test-user-id',
      name: 'Test Customer with Location',
      phone: '972501234567',
      area: 'Test Area',
      longitude: 34.7818,
      latitude: 32.0853,
      location_received: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    const { data: insertedCustomer, error: insertError } = await supabase
      .from('customers')
      .insert([testCustomerData])
      .select();

    if (insertError) {
      console.error('❌ Error inserting test customer:', insertError.message);
      throw insertError;
    }

    console.log('✅ Successfully inserted test customer with location data');
    console.log('   Customer ID:', insertedCustomer[0].id);
    console.log('   Location:', `${insertedCustomer[0].latitude}, ${insertedCustomer[0].longitude}`);

    // Test 4: Try to insert a test message with location type
    console.log('\n4. Testing location message insertion...');
    
    const testMessageData = {
      user_id: 'test-user-id',
      customer_id: insertedCustomer[0].id,
      message_text: 'Test location message',
      status: 'received',
      message_type: 'location',
      created_at: new Date()
    };

    const { data: insertedMessage, error: messageInsertError } = await supabase
      .from('message_history')
      .insert([testMessageData])
      .select();

    if (messageInsertError) {
      console.error('❌ Error inserting test message:', messageInsertError.message);
      throw messageInsertError;
    }

    console.log('✅ Successfully inserted test message with location type');
    console.log('   Message ID:', insertedMessage[0].id);
    console.log('   Message Type:', insertedMessage[0].message_type);

    // Test 5: Clean up test data
    console.log('\n5. Cleaning up test data...');
    
    await supabase
      .from('message_history')
      .delete()
      .eq('id', insertedMessage[0].id);

    await supabase
      .from('customers')
      .delete()
      .eq('id', insertedCustomer[0].id);

    console.log('✅ Test data cleaned up');

    // Test 6: Check if calculate_distance function exists
    console.log('\n6. Checking calculate_distance function...');
    
    try {
      const { data: distanceResult, error: distanceError } = await supabase
        .rpc('calculate_distance', {
          lat1: 32.0853,
          lon1: 34.7818,
          lat2: 32.0854,
          lon2: 34.7819
        });

      if (distanceError) {
        console.log('⚠️  calculate_distance function not found (optional)');
      } else {
        console.log('✅ calculate_distance function exists');
        console.log('   Distance:', distanceResult, 'km');
      }
    } catch (error) {
      console.log('⚠️  calculate_distance function not found (optional)');
    }

    console.log('\n🎉 All tests passed! Location message listener is ready to use.');
    console.log('\n📋 Next steps:');
    console.log('1. Start your WhatsApp server');
    console.log('2. Connect WhatsApp to the application');
    console.log('3. Send a location message to test the functionality');
    console.log('4. Check the customers table for location updates');
    
    // Test phone number conversion
    console.log('\n📱 Phone Number Conversion Test:');
    const testNumbers = [
      '972526686285',  // Should convert to 0526686285
      '+972526686285', // Should convert to 0526686285
      '972501234567',  // Should convert to 0501234567
      '1234567890',    // Should remain unchanged
      '972123456789'   // Should remain unchanged (doesn't start with 5)
    ];
    
    testNumbers.forEach(original => {
      const converted = convertWhatsAppPhoneToLocal(original);
      console.log(`   ${original} -> ${converted}`);
    });

    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure you have run the SQL script: add-location-fields-to-customers.sql');
    console.log('2. Check your Supabase credentials');
    console.log('3. Verify database permissions');
    return false;
  }
}

// Run the test
testLocationFields()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
