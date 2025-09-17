#!/usr/bin/env node

const http = require('http');
const net = require('net');

console.log('🔍 Network Connectivity Test');
console.log('============================\n');

const SERVER_IP = '192.168.0.113';
const SERVER_PORT = 3000;

// Test 1: Check if port is open
function testPortConnectivity() {
  return new Promise((resolve) => {
    console.log(`1. Testing port connectivity to ${SERVER_IP}:${SERVER_PORT}...`);
    
    const socket = new net.Socket();
    const timeout = 5000;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log('   ✅ Port is open and accessible');
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.log('   ❌ Connection timeout');
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (err) => {
      console.log('   ❌ Connection failed:', err.message);
      resolve(false);
    });
    
    socket.connect(SERVER_PORT, SERVER_IP);
  });
}

// Test 2: Check HTTP health endpoint
function testHttpHealth() {
  return new Promise((resolve) => {
    console.log(`2. Testing HTTP health endpoint...`);
    
    const options = {
      hostname: SERVER_IP,
      port: SERVER_PORT,
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
          console.log('   ✅ HTTP health endpoint working');
          console.log('   📄 Response:', data);
          resolve(true);
        } else {
          console.log('   ❌ HTTP health endpoint failed:', res.statusCode);
          resolve(false);
        }
      });
    });
    
    req.on('timeout', () => {
      console.log('   ❌ HTTP request timeout');
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (err) => {
      console.log('   ❌ HTTP request failed:', err.message);
      resolve(false);
    });
    
    req.end();
  });
}

// Test 3: Check WhatsApp status endpoint
function testWhatsAppStatus() {
  return new Promise((resolve) => {
    console.log(`3. Testing WhatsApp status endpoint...`);
    
    const options = {
      hostname: SERVER_IP,
      port: SERVER_PORT,
      path: '/api/whatsapp/status/test-user',
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
          console.log('   ✅ WhatsApp status endpoint working');
          try {
            const jsonData = JSON.parse(data);
            console.log('   📄 Response:', JSON.stringify(jsonData, null, 2));
          } catch (e) {
            console.log('   📄 Response:', data);
          }
          resolve(true);
        } else {
          console.log('   ❌ WhatsApp status endpoint failed:', res.statusCode);
          resolve(false);
        }
      });
    });
    
    req.on('timeout', () => {
      console.log('   ❌ HTTP request timeout');
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (err) => {
      console.log('   ❌ HTTP request failed:', err.message);
      resolve(false);
    });
    
    req.end();
  });
}

// Test 4: Check WhatsApp connect endpoint
function testWhatsAppConnect() {
  return new Promise((resolve) => {
    console.log(`4. Testing WhatsApp connect endpoint...`);
    
    const postData = JSON.stringify({});
    
    const options = {
      hostname: SERVER_IP,
      port: SERVER_PORT,
      path: '/api/whatsapp/connect/test-user',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000 // Longer timeout for connection
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('   ✅ WhatsApp connect endpoint working');
          try {
            const jsonData = JSON.parse(data);
            console.log('   📄 Response:', JSON.stringify(jsonData, null, 2));
          } catch (e) {
            console.log('   📄 Response:', data);
          }
          resolve(true);
        } else {
          console.log('   ❌ WhatsApp connect endpoint failed:', res.statusCode);
          console.log('   📄 Response:', data);
          resolve(false);
        }
      });
    });
    
    req.on('timeout', () => {
      console.log('   ❌ HTTP request timeout');
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (err) => {
      console.log('   ❌ HTTP request failed:', err.message);
      resolve(false);
    });
    
    req.write(postData);
    req.end();
  });
}

// Run all tests
async function runTests() {
  console.log(`🎯 Testing connectivity to ${SERVER_IP}:${SERVER_PORT}\n`);
  
  const results = {
    portConnectivity: await testPortConnectivity(),
    httpHealth: await testHttpHealth(),
    whatsappStatus: await testWhatsAppStatus(),
    whatsappConnect: await testWhatsAppConnect()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Port Connectivity: ${results.portConnectivity ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`HTTP Health: ${results.httpHealth ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`WhatsApp Status: ${results.whatsappStatus ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`WhatsApp Connect: ${results.whatsappConnect ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Server is fully accessible.');
    console.log('\n💡 If mobile app still shows "Network request failed":');
    console.log('   1. Check mobile device is on same network (192.168.0.x)');
    console.log('   2. Verify mobile app is using correct IP address');
    console.log('   3. Check mobile device firewall/security settings');
    console.log('   4. Try restarting mobile app');
  } else {
    console.log('\n❌ Some tests failed. Server may not be accessible.');
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Check if server is running: node server-supabase.js');
    console.log('   2. Verify IP address: ifconfig | grep "inet "');
    console.log('   3. Check firewall settings');
    console.log('   4. Ensure port 3000 is not blocked');
  }
  
  console.log('\n📱 Mobile App Configuration:');
  console.log(`   Update LAN_IP in mobile/src/services/apiBase.js to: ${SERVER_IP}`);
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
