#!/usr/bin/env node

// Test script for phone number matching logic

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

// Test phone number matching
function testPhoneMatching() {
  console.log('🧪 Testing Phone Number Matching Logic');
  console.log('=====================================\n');

  // Test cases
  const testCases = [
    {
      whatsappPhone: '972526686285',
      expectedLocal: '0526686285',
      description: 'Standard Israeli mobile number'
    },
    {
      whatsappPhone: '+972526686285',
      expectedLocal: '0526686285',
      description: 'Israeli mobile with + prefix'
    },
    {
      whatsappPhone: '972501234567',
      expectedLocal: '0501234567',
      description: 'Another Israeli mobile number'
    },
    {
      whatsappPhone: '1234567890',
      expectedLocal: '1234567890',
      description: 'Non-Israeli number (unchanged)'
    }
  ];

  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.description}`);
    console.log(`  WhatsApp: ${testCase.whatsappPhone}`);
    
    const localPhone = convertWhatsAppPhoneToLocal(testCase.whatsappPhone);
    console.log(`  Local:    ${localPhone}`);
    console.log(`  Expected: ${testCase.expectedLocal}`);
    console.log(`  ✅ Match: ${localPhone === testCase.expectedLocal ? 'YES' : 'NO'}`);
    
    const normalizedWhatsApp = normalizePhoneNumber(testCase.whatsappPhone);
    const normalizedLocal = normalizePhoneNumber(localPhone);
    console.log(`  Normalized WhatsApp: ${normalizedWhatsApp}`);
    console.log(`  Normalized Local:    ${normalizedLocal}`);
    console.log(`  ✅ Normalized Match: ${normalizedWhatsApp === normalizedLocal ? 'YES' : 'NO'}`);
    console.log('');
  });

  // Test customer matching scenarios
  console.log('🔍 Customer Matching Scenarios:');
  console.log('================================\n');

  const customerDatabase = [
    { id: 1, name: 'Customer 1', phone: '0526686285', phone2: null },
    { id: 2, name: 'Customer 2', phone: '0501234567', phone2: '972526686285' },
    { id: 3, name: 'Customer 3', phone: '972526686285', phone2: null },
    { id: 4, name: 'Customer 4', phone: '0526686285', phone2: '0501234567' },
    { id: 5, name: 'Customer 5', phone: '1234567890', phone2: null }
  ];

  const incomingWhatsAppPhone = '972526686285';
  const incomingLocalPhone = convertWhatsAppPhoneToLocal(incomingWhatsAppPhone);
  const normalizedIncomingWhatsApp = normalizePhoneNumber(incomingWhatsAppPhone);
  const normalizedIncomingLocal = normalizePhoneNumber(incomingLocalPhone);

  console.log(`Incoming WhatsApp phone: ${incomingWhatsAppPhone}`);
  console.log(`Incoming Local phone: ${incomingLocalPhone}`);
  console.log(`Normalized WhatsApp: ${normalizedIncomingWhatsApp}`);
  console.log(`Normalized Local: ${normalizedIncomingLocal}\n`);

  console.log('Checking for matches in database:');
  customerDatabase.forEach(customer => {
    const customerPhoneNormalized = normalizePhoneNumber(customer.phone);
    const customerPhone2Normalized = normalizePhoneNumber(customer.phone2);
    
    const isMatch = customerPhoneNormalized === normalizedIncomingWhatsApp || 
                   customerPhoneNormalized === normalizedIncomingLocal ||
                   customerPhone2Normalized === normalizedIncomingWhatsApp || 
                   customerPhone2Normalized === normalizedIncomingLocal;
    
    console.log(`  ${customer.name} (ID: ${customer.id}):`);
    console.log(`    Phone: ${customer.phone} -> ${customerPhoneNormalized}`);
    console.log(`    Phone2: ${customer.phone2 || 'null'} -> ${customerPhone2Normalized}`);
    console.log(`    ${isMatch ? '✅ MATCH!' : '❌ No match'}`);
    console.log('');
  });
}

// Run the test
testPhoneMatching();
