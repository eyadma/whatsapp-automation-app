#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing WhatsApp Connection Issues');
console.log('===================================\n');

const serverFile = path.join(__dirname, 'server-supabase.js');

if (!fs.existsSync(serverFile)) {
  console.error('❌ server-supabase.js not found');
  process.exit(1);
}

console.log('📖 Reading server file...');
let content = fs.readFileSync(serverFile, 'utf8');

console.log('🔍 Analyzing connection-related logging...');

// Restore critical error logging that might have been over-optimized
const criticalLoggingFixes = [
  // Restore error logging in connectWhatsApp function
  {
    pattern: /\/\/ logger\.error\(`Error connecting WhatsApp for user: \$\{userId\}`, error\.message\);/g,
    replacement: 'logger.error(`Error connecting WhatsApp for user: ${userId}`, error.message);'
  },
  {
    pattern: /\/\/ logger\.error\(`Failed to create WhatsApp socket for user: \$\{userId\}`\);/g,
    replacement: 'logger.error(`Failed to create WhatsApp socket for user: ${userId}`);'
  },
  {
    pattern: /\/\/ logger\.error\(`Connection failed for user: \$\{userId\}`\);/g,
    replacement: 'logger.error(`Connection failed for user: ${userId}`);'
  },
  
  // Restore important connection status logging
  {
    pattern: /\/\/ logger\.info\(`Connection opened for user: \$\{userId\}`\);/g,
    replacement: 'logger.info(`Connection opened for user: ${userId}`);'
  },
  {
    pattern: /\/\/ logger\.warn\(`Connection closed for user: \$\{userId\}, session: \$\{sessionId\}`\);/g,
    replacement: 'logger.warn(`Connection closed for user: ${userId}, session: ${sessionId}`);'
  },
  
  // Restore QR code logging (important for debugging)
  {
    pattern: /\/\/ logger\.info\(`QR code generated for user: \$\{userId\}`\);/g,
    replacement: 'logger.info(`QR code generated for user: ${userId}`);'
  },
  
  // Restore connection attempt logging
  {
    pattern: /\/\/ logger\.info\(`Connecting WhatsApp for user: \$\{userId\}`\);/g,
    replacement: 'logger.info(`Connecting WhatsApp for user: ${userId}`);'
  },
  {
    pattern: /\/\/ logger\.info\(`Starting WhatsApp connection for user: \$\{userId\}`\);/g,
    replacement: 'logger.info(`Starting WhatsApp connection for user: ${userId}`);'
  }
];

// Apply critical logging fixes
let fixCount = 0;
criticalLoggingFixes.forEach(({ pattern, replacement }) => {
  const matches = content.match(pattern);
  if (matches) {
    content = content.replace(pattern, replacement);
    fixCount += matches.length;
  }
});

console.log(`✅ Applied ${fixCount} critical logging fixes`);

// Add better error handling to the connectWhatsApp function
const betterErrorHandling = `
// Enhanced error handling for WhatsApp connection
function handleWhatsAppConnectionError(userId, sessionId, error, context) {
  const errorDetails = {
    userId,
    sessionId,
    context,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
  
  logger.error(\`WhatsApp connection error in \${context} for user \${userId}\`, errorDetails);
  
  // Clean up any partial connection state
  try {
    const connection = getConnection(userId, sessionId);
    if (connection) {
      if (connection.sock) {
        connection.sock.end();
      }
      removeConnection(userId, sessionId);
    }
  } catch (cleanupError) {
    logger.error(\`Error during connection cleanup for user \${userId}\`, cleanupError.message);
  }
}
`;

// Add the error handling function after the logger import
content = content.replace(
  /const { logger } = require\('\.\/optimized-logger'\);/,
  `const { logger } = require('./optimized-logger');\n${betterErrorHandling}`
);

// Update the connectWhatsApp function to use better error handling
const connectWhatsAppErrorHandling = `
  } catch (error) {
    handleWhatsAppConnectionError(userId, sessionId, error, 'connectWhatsApp');
    throw error; // Re-throw to maintain existing error flow
  }`;

// Find and update the connectWhatsApp function's catch block
content = content.replace(
  /} catch \(error\) \{\s*logger\.error\(`Error connecting WhatsApp for user: \$\{userId\}`, error\.message\);\s*throw error;\s*\}/g,
  connectWhatsAppErrorHandling
);

// Add connection validation
const connectionValidation = `
// Validate connection parameters
function validateConnectionParams(userId, sessionId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid userId: must be a non-empty string');
  }
  
  if (sessionId && typeof sessionId !== 'string') {
    throw new Error('Invalid sessionId: must be a string or null');
  }
  
  // Check if userId is a valid UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    logger.warn(\`UserId \${userId} is not in standard UUID format\`);
  }
  
  return true;
}
`;

// Add validation function
content = content.replace(
  /const { logger } = require\('\.\/optimized-logger'\);/,
  `const { logger } = require('./optimized-logger');\n${connectionValidation}`
);

// Update the connect endpoint to use validation
content = content.replace(
  /app\.post\('\/api\/whatsapp\/connect\/:userId\/:sessionId', async \(req, res\) => \{\s*try \{\s*const { userId, sessionId } = req\.params;/,
  `app.post('/api/whatsapp/connect/:userId/:sessionId', async (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    
    // Validate connection parameters
    validateConnectionParams(userId, sessionId);`

// Add response timeout handling
const responseTimeoutHandling = `
// Set response timeout to prevent hanging requests
const RESPONSE_TIMEOUT = 30000; // 30 seconds

function setResponseTimeout(res, timeout = RESPONSE_TIMEOUT) {
  return setTimeout(() => {
    if (!res.headersSent) {
      logger.error('Request timeout - no response sent within timeout period');
      res.status(408).json({ 
        success: false, 
        error: 'Request timeout',
        message: 'The request took too long to process'
      });
    }
  }, timeout);
}
`;

// Add timeout handling
content = content.replace(
  /const { logger } = require\('\.\/optimized-logger'\);/,
  `const { logger } = require('./optimized-logger');\n${responseTimeoutHandling}`
);

// Update the connect endpoint to use timeout
content = content.replace(
  /app\.post\('\/api\/whatsapp\/connect\/:userId\/:sessionId', async \(req, res\) => \{\s*try \{\s*const { userId, sessionId } = req\.params;/,
  `app.post('/api/whatsapp/connect/:userId/:sessionId', async (req, res) => {
  const timeoutId = setResponseTimeout(res);
  
  try {
    const { userId, sessionId } = req.params;`);

// Clear timeout on successful response
content = content.replace(
  /res\.json\(\{ success: true, message: 'Connecting to WhatsApp\.\.\.' \}\);/,
  `clearTimeout(timeoutId);
    res.json({ success: true, message: 'Connecting to WhatsApp...' });`);

// Clear timeout on error response
content = content.replace(
  /res\.status\(500\)\.json\(\{ success: false, error: 'Failed to connect' \}\);/,
  `clearTimeout(timeoutId);
    res.status(500).json({ success: false, error: 'Failed to connect' });`);

// Write the fixed file
console.log('💾 Writing fixed server file...');
fs.writeFileSync(serverFile, content);

console.log('\n✅ WhatsApp connection fix complete!');
console.log('===================================');

console.log('\n🔧 Fixes Applied:');
console.log('=================');
console.log('• Restored critical error logging');
console.log('• Added enhanced error handling function');
console.log('• Added connection parameter validation');
console.log('• Added response timeout handling');
console.log('• Improved connection cleanup on errors');
console.log('• Added UUID format validation');

console.log('\n🚀 Next Steps:');
console.log('==============');
console.log('1. Commit and deploy the fixed server');
console.log('2. Test WhatsApp connection endpoint');
console.log('3. Monitor Railway logs for improvements');

console.log('\n📊 Expected Results:');
console.log('===================');
console.log('• Better error messages in logs');
console.log('• No more hanging requests');
console.log('• Proper connection cleanup on errors');
console.log('• More reliable WhatsApp connections');
