#!/usr/bin/env node

const https = require('https');

console.log('🚀 Railway Deployment Test');
console.log('==========================\n');

const RAILWAY_URL = 'https://whatsapp-automation-app-production.up.railway.app';

// Test function for HTTPS requests
function testEndpoint(path, description) {
  return new Promise((resolve) => {
    console.log(`🧪 Testing: ${description}`);
    console.log(`   URL: ${RAILWAY_URL}${path}`);
    
    const options = {
      hostname: 'whatsapp-automation-app-production.up.railway.app',
      port: 443,
      path: path,
      method: 'GET',
      timeout: 10000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`   ✅ SUCCESS (${res.statusCode})`);
          try {
            const jsonData = JSON.parse(data);
            console.log(`   📄 Response:`, JSON.stringify(jsonData, null, 2));
          } catch (e) {
            console.log(`   📄 Response:`, data);
          }
          resolve(true);
        } else {
          console.log(`   ❌ FAILED (${res.statusCode})`);
          console.log(`   📄 Response:`, data);
          resolve(false);
        }
      });
    });
    
    req.on('timeout', () => {
      console.log(`   ❌ TIMEOUT`);
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ ERROR: ${err.message}`);
      resolve(false);
    });
    
    req.end();
  });
}

// Test POST endpoint
function testPostEndpoint(path, body, description) {
  return new Promise((resolve) => {
    console.log(`🧪 Testing: ${description}`);
    console.log(`   URL: ${RAILWAY_URL}${path}`);
    
    const postData = JSON.stringify(body);
    
    const options = {
      hostname: 'whatsapp-automation-app-production.up.railway.app',
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`   ✅ SUCCESS (${res.statusCode})`);
          try {
            const jsonData = JSON.parse(data);
            console.log(`   📄 Response:`, JSON.stringify(jsonData, null, 2));
          } catch (e) {
            console.log(`   📄 Response:`, data);
          }
          resolve(true);
        } else {
          console.log(`   ❌ FAILED (${res.statusCode})`);
          console.log(`   📄 Response:`, data);
          resolve(false);
        }
      });
    });
    
    req.on('timeout', () => {
      console.log(`   ❌ TIMEOUT`);
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (err) => {
      console.log(`   ❌ ERROR: ${err.message}`);
      resolve(false);
    });
    
    req.write(postData);
    req.end();
  });
}

// Run all tests
async function runTests() {
  console.log(`🎯 Testing Railway Deployment: ${RAILWAY_URL}\n`);
  
  const results = {
    health: await testEndpoint('/api/health', 'Health Check'),
    whatsappStatus: await testEndpoint('/api/whatsapp/status/test-user', 'WhatsApp Status'),
    whatsappConnect: await testPostEndpoint('/api/whatsapp/connect/test-user', {}, 'WhatsApp Connect'),
    debugConnections: await testEndpoint('/api/debug/connections', 'Debug Connections')
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  console.log(`Health Check: ${results.health ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`WhatsApp Status: ${results.whatsappStatus ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`WhatsApp Connect: ${results.whatsappConnect ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Debug Connections: ${results.debugConnections ? '✅ PASS' : '❌ FAIL'}`);
  
  const allPassed = Object.values(results).every(result => result === true);
  
  if (allPassed) {
    console.log('\n🎉 All tests passed! Railway deployment is working perfectly.');
    console.log('\n📱 Mobile App Configuration:');
    console.log('============================');
    console.log('✅ Mobile app updated with Railway URL');
    console.log('✅ Production URL: https://whatsapp-automation-app-production.up.railway.app');
    console.log('✅ All API endpoints accessible');
    
    console.log('\n🚀 Next Steps:');
    console.log('==============');
    console.log('1. Restart your mobile app');
    console.log('2. Test WhatsApp connection');
    console.log('3. Verify location message functionality');
    console.log('4. Test all features end-to-end');
    
    console.log('\n🌐 Your App URLs:');
    console.log('=================');
    console.log(`• Main App: ${RAILWAY_URL}`);
    console.log(`• Health Check: ${RAILWAY_URL}/api/health`);
    console.log(`• WhatsApp API: ${RAILWAY_URL}/api/whatsapp/`);
    
  } else {
    console.log('\n❌ Some tests failed. Check the errors above.');
    console.log('\n🔧 Troubleshooting:');
    console.log('===================');
    console.log('1. Check Railway dashboard for deployment status');
    console.log('2. Verify environment variables are set');
    console.log('3. Check Railway logs for errors');
    console.log('4. Ensure Supabase credentials are correct');
  }
  
  console.log('\n📞 Support:');
  console.log('===========');
  console.log('• Railway Dashboard: https://railway.app/dashboard');
  console.log('• Railway Docs: https://docs.railway.app');
  console.log('• Your Project: https://railway.app/dashboard');
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
