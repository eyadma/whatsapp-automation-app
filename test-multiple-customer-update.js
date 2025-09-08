#!/usr/bin/env node

// Test script for multiple customer update logic

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
      // Convert to Israeli format: 0526686285
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
  
  // Handle Israeli numbers: if it starts with 05, remove the 0
  if (normalized.startsWith('05') && normalized.length === 10) {
    normalized = normalized.substring(1);
  }
  
  // Handle international format: if it starts with 972, keep as is
  if (normalized.startsWith('972')) {
    return normalized;
  }
  
  // For other formats, add 972 prefix if it's a 9-digit number starting with 5
  if (normalized.startsWith('5') && normalized.length === 9) {
    normalized = '972' + normalized;
  }
  
  return normalized;
}

// Test the multiple customer update logic
function testMultipleCustomerUpdate() {
  console.log('🧪 Testing Multiple Customer Update Logic');
  console.log('========================================\n');

  // Simulate the scenario from your database
  const incomingWhatsAppPhone = '972526686285';
  const incomingLocalPhone = convertWhatsAppPhoneToLocal(incomingWhatsAppPhone);
  
  console.log(`📱 Incoming WhatsApp phone: ${incomingWhatsAppPhone}`);
  console.log(`📱 Converted to local: ${incomingLocalPhone}\n`);

  // Simulate your database with 9 customers having the same phone number
  const customerDatabase = [
    { id: 99, name: 'E M', phone: '0526686285', phone2: null },
    { id: 97, name: 'E M', phone: '972526686285', phone2: null },
    { id: 32, name: 'ياسمين', phone: '0526686285', phone2: null },
    { id: 28, name: 'بهاء ديك', phone: '0526686285', phone2: null },
    { id: 19, name: 'قمر', phone: '0526686285', phone2: null },
    { id: 6, name: 'מיכל', phone: '0526686285', phone2: null },
    { id: 4, name: 'A3a', phone: '0526686285', phone2: null },
    { id: 3, name: 'בניימין בבייב', phone: '0526686285', phone2: null },
    { id: 2, name: 'حسن', phone: '0526686285', phone2: null }
  ];

  console.log(`📊 Total customers in database: ${customerDatabase.length}\n`);

  // Normalize incoming phone numbers
  const normalizedWhatsAppPhone = normalizePhoneNumber(incomingWhatsAppPhone);
  const normalizedLocalPhone = normalizePhoneNumber(incomingLocalPhone);
  
  console.log(`🔍 Normalized phone numbers:`);
  console.log(`   WhatsApp: ${incomingWhatsAppPhone} -> ${normalizedWhatsAppPhone}`);
  console.log(`   Local: ${incomingLocalPhone} -> ${normalizedLocalPhone}\n`);

  // Find ALL matching customers (this is the new logic)
  let matchingCustomers = [];
  
  customerDatabase.forEach(customer => {
    const customerPhoneNormalized = normalizePhoneNumber(customer.phone);
    const customerPhone2Normalized = normalizePhoneNumber(customer.phone2);
    
    console.log(`   Checking customer: ${customer.name} (ID: ${customer.id})`);
    console.log(`     Phone: ${customer.phone} -> Normalized: ${customerPhoneNormalized}`);
    console.log(`     Phone2: ${customer.phone2 || 'null'} -> Normalized: ${customerPhone2Normalized}`);
    
    if (customerPhoneNormalized === normalizedWhatsAppPhone || 
        customerPhoneNormalized === normalizedLocalPhone ||
        customerPhone2Normalized === normalizedWhatsAppPhone || 
        customerPhone2Normalized === normalizedLocalPhone) {
      console.log(`     ✅ MATCH! Adding to update list`);
      matchingCustomers.push(customer);
    } else {
      console.log(`     ❌ No match`);
    }
    console.log('');
  });

  console.log(`🎯 Results:`);
  console.log(`   Total customers checked: ${customerDatabase.length}`);
  console.log(`   Matching customers found: ${matchingCustomers.length}`);
  
  if (matchingCustomers.length > 0) {
    console.log(`\n📝 Customers that will be updated:`);
    matchingCustomers.forEach((customer, index) => {
      console.log(`   ${index + 1}. ${customer.name} (ID: ${customer.id})`);
      console.log(`      Phone: ${customer.phone}`);
      console.log(`      Phone2: ${customer.phone2 || 'null'}`);
    });
    
    console.log(`\n🔄 Update Summary:`);
    console.log(`   - All ${matchingCustomers.length} customers will receive location update`);
    console.log(`   - Location data will be synchronized across all matching records`);
    console.log(`   - No new customer will be created`);
    console.log(`   - Each customer will get a message history entry`);
  } else {
    console.log(`\n❌ No matching customers found. New customer will be created.`);
  }

  console.log(`\n💡 Benefits of this approach:`);
  console.log(`   ✅ Prevents duplicate customer creation`);
  console.log(`   ✅ Updates all related customer records`);
  console.log(`   ✅ Maintains data consistency`);
  console.log(`   ✅ Provides comprehensive logging`);
  console.log(`   ✅ Handles both phone and phone2 fields`);
}

// Run the test
testMultipleCustomerUpdate();
