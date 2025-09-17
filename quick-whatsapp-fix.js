#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Quick WhatsApp Connection Fix');
console.log('===============================\n');

const serverFile = path.join(__dirname, 'server-supabase.js');

if (!fs.existsSync(serverFile)) {
  console.error('❌ server-supabase.js not found');
  process.exit(1);
}

console.log('📖 Reading server file...');
let content = fs.readFileSync(serverFile, 'utf8');

console.log('🔍 Applying targeted fixes...');

// Fix 1: Restore critical error logging that was over-optimized
const criticalFixes = [
  {
    from: '// logger.error(`Error connecting WhatsApp for user: ${userId}`, error.message);',
    to: 'logger.error(`Error connecting WhatsApp for user: ${userId}`, error.message);'
  },
  {
    from: '// logger.info(`Connection opened for user: ${userId}`);',
    to: 'logger.info(`Connection opened for user: ${userId}`);'
  },
  {
    from: '// logger.warn(`Connection closed for user: ${userId}, session: ${sessionId}`);',
    to: 'logger.warn(`Connection closed for user: ${userId}, session: ${sessionId}`);'
  },
  {
    from: '// logger.info(`QR code generated for user: ${userId}`);',
    to: 'logger.info(`QR code generated for user: ${userId}`);'
  }
];

let fixCount = 0;
criticalFixes.forEach(({ from, to }) => {
  if (content.includes(from)) {
    content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
    fixCount++;
  }
});

console.log(`✅ Applied ${fixCount} critical logging fixes`);

// Fix 2: Add better error handling to the connect endpoint
const errorHandlingFix = `
// Enhanced error handling for connection endpoint
function handleConnectionError(res, error, context) {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };
  
  logger.error(\`Connection error in \${context}\`, errorInfo);
  
  if (!res.headersSent) {
    res.status(500).json({ 
      success: false, 
      error: 'Connection failed',
      details: error.message,
      timestamp: errorInfo.timestamp
    });
  }
}`;

// Add error handling function after logger import
content = content.replace(
  /const { logger } = require\('\.\/optimized-logger'\);/,
  `const { logger } = require('./optimized-logger');\n${errorHandlingFix}`
);

// Fix 3: Update the session-specific connect endpoint to use better error handling
const endpointFix = `
app.post('/api/whatsapp/connect/:userId/:sessionId', async (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    
    // Validate parameters
    if (!userId || !sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: userId and sessionId' 
      });
    }
    
    logger.info(\`Connecting WhatsApp for user: \${userId}, session: \${sessionId}\`);
    
    // Check if there's an existing connection for this session
    const existingConnection = getConnection(userId, sessionId);
    
    if (existingConnection) {
      logger.info(\`Existing connection found for user: \${userId}, session: \${sessionId}\`);
      
      // If already connected, return success
      if (existingConnection.connected) {
        logger.info(\`User \${userId}, session \${sessionId} is already connected\`);
        return res.json({ success: true, message: 'Already connected to WhatsApp' });
      }
      
      // If connecting, return success
      if (existingConnection.connecting) {
        logger.info(\`User \${userId}, session \${sessionId} is already connecting\`);
        return res.json({ success: true, message: 'Already connecting to WhatsApp...' });
      }
      
      // Clean up stale connection
      logger.info(\`Cleaning up stale connection for user: \${userId}, session: \${sessionId}\`);
      removeConnection(userId, sessionId);
    }

    logger.info(\`Starting new WhatsApp connection for user: \${userId}, session: \${sessionId}\`);
    await connectWhatsApp(userId, sessionId);
    
    res.json({ success: true, message: 'Connecting to WhatsApp...' });
  } catch (error) {
    handleConnectionError(res, error, 'connect endpoint');
  }
});`;

// Replace the existing endpoint
const existingEndpointRegex = /app\.post\('\/api\/whatsapp\/connect\/:userId\/:sessionId', async \(req, res\) => \{[\s\S]*?\}\);/;
content = content.replace(existingEndpointRegex, endpointFix);

console.log('✅ Updated connect endpoint with better error handling');

// Write the fixed file
console.log('💾 Writing fixed server file...');
fs.writeFileSync(serverFile, content);

console.log('\n✅ Quick WhatsApp connection fix complete!');
console.log('==========================================');

console.log('\n🔧 Fixes Applied:');
console.log('=================');
console.log('• Restored critical error logging');
console.log('• Added enhanced error handling function');
console.log('• Added parameter validation');
console.log('• Improved error responses');
console.log('• Better connection state management');

console.log('\n🚀 Next Steps:');
console.log('==============');
console.log('1. Test the server locally: node server-supabase.js');
console.log('2. Commit and deploy to Railway');
console.log('3. Test the WhatsApp connection endpoint');

console.log('\n📊 Expected Results:');
console.log('===================');
console.log('• Better error messages in logs');
console.log('• Proper HTTP status codes');
console.log('• More reliable connections');
console.log('• No more 500 errors on valid requests');
