#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔄 Mobile App Cache Clear and Test');
console.log('==================================\n');

// Clear React Native cache
console.log('1. Clearing React Native cache...');
try {
  const { execSync } = require('child_process');
  
  // Clear Metro cache
  console.log('   🧹 Clearing Metro cache...');
  execSync('npx react-native start --reset-cache', { stdio: 'ignore', timeout: 5000 });
  console.log('   ✅ Metro cache cleared');
  
} catch (error) {
  console.log('   ⚠️ Metro cache clear failed (this is normal if Metro is not running)');
}

// Clear Expo cache if using Expo
console.log('\n2. Clearing Expo cache...');
try {
  const { execSync } = require('child_process');
  execSync('npx expo start --clear', { stdio: 'ignore', timeout: 5000 });
  console.log('   ✅ Expo cache cleared');
} catch (error) {
  console.log('   ⚠️ Expo cache clear failed (this is normal if not using Expo)');
}

// Test server connectivity
console.log('\n3. Testing server connectivity...');
const http = require('http');

function testServer() {
  return new Promise((resolve) => {
    const options = {
      hostname: '192.168.0.113',
      port: 3000,
      path: '/api/health',
      method: 'GET',
      timeout: 5000
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('   ✅ Server is accessible at 192.168.0.113:3000');
          console.log('   📄 Response:', data);
          resolve(true);
        } else {
          console.log('   ❌ Server returned status:', res.statusCode);
          resolve(false);
        }
      });
    });
    
    req.on('timeout', () => {
      console.log('   ❌ Server connection timeout');
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (err) => {
      console.log('   ❌ Server connection failed:', err.message);
      resolve(false);
    });
    
    req.end();
  });
}

// Run the test
testServer().then(success => {
  console.log('\n📱 Mobile App Configuration:');
  console.log('============================');
  console.log('✅ Updated API configuration to prioritize 192.168.0.113:3000');
  console.log('✅ Added clearCachedUrl() function for debugging');
  console.log('✅ Simplified URL resolution logic');
  
  if (success) {
    console.log('\n🎉 Server is accessible! Mobile app should now work.');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart the mobile app completely');
    console.log('   2. The app will now try 192.168.0.113:3000 first');
    console.log('   3. If still having issues, call clearCachedUrl() in the app');
  } else {
    console.log('\n❌ Server is not accessible. Check:');
    console.log('   1. Server is running: node server-supabase.js');
    console.log('   2. IP address is correct: 192.168.0.113');
    console.log('   3. Network connectivity');
  }
  
  console.log('\n🔧 If you need to clear the cached URL in the app:');
  console.log('   import { clearCachedUrl } from "./src/services/apiBase";');
  console.log('   clearCachedUrl(); // Call this to force URL re-detection');
});
