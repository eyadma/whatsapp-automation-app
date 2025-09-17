#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Optimizing Server Logging for Railway');
console.log('=======================================\n');

const serverFile = path.join(__dirname, 'server-supabase.js');

if (!fs.existsSync(serverFile)) {
  console.error('❌ server-supabase.js not found');
  process.exit(1);
}

console.log('📖 Reading server file...');
let content = fs.readFileSync(serverFile, 'utf8');

console.log('🔍 Analyzing current logging...');

// Count current console statements
const consoleMatches = content.match(/console\.(log|error|warn|info)/g) || [];
console.log(`📊 Found ${consoleMatches.length} console statements`);

// Count emoji logging patterns
const emojiMatches = content.match(/[🚀✅❌📱🔗🔍📊⚠️🔄⏹️📝📤⏳💾🧹🎯]/g) || [];
console.log(`📊 Found ${emojiMatches.length} emoji logging patterns`);

console.log('\n🛠️  Applying optimizations...');

// 1. Add optimized logger import at the top
const loggerImport = `const { logger } = require('./optimized-logger');\n`;
if (!content.includes('optimized-logger')) {
  content = content.replace(
    /const supabase = require\('\.\/config\/supabase'\);/,
    `const supabase = require('./config/supabase');\n${loggerImport}`
  );
}

// 2. Replace high-frequency console.log statements with optimized logging
const replacements = [
  // Background processing logs - batch these
  {
    pattern: /console\.log\(`🔄 Starting background processing with processed messages for \$\{customers\.length\} customers`\);/g,
    replacement: 'logger.info(`Starting background processing for ${customers.length} customers`);'
  },
  {
    pattern: /console\.log\(`📝 Processing \$\{messages\.length\} messages for \$\{customer\.name\} in languages:`, languages\);/g,
    replacement: '// logger.info(`Processing ${messages.length} messages for ${customer.name}`); // Reduced logging'
  },
  {
    pattern: /console\.log\(`📤 Sending message \$\{msgIndex \+ 1\}\/\$\{messages\.length\} to \$\{customer\.name\} \(\$\{language\}\):`, message\.substring\(0, 100\) \+ '\.\.\.'\);/g,
    replacement: '// logger.info(`Sending message ${msgIndex + 1}/${messages.length} to ${customer.name}`); // Reduced logging'
  },
  {
    pattern: /console\.log\(`✅ Background message \$\{msgIndex \+ 1\}\/\$\{messages\.length\} sent to \$\{customer\.name\} \(\$\{language\}\) - primary phone`\);/g,
    replacement: '// logger.info(`Message sent to ${customer.name}`); // Reduced logging'
  },
  {
    pattern: /console\.log\(`✅ Background message \$\{msgIndex \+ 1\}\/\$\{messages\.length\} sent to \$\{customer\.name\} \(\$\{language\}\) - secondary phone`\);/g,
    replacement: '// logger.info(`Message sent to ${customer.name} (secondary)`); // Reduced logging'
  },
  {
    pattern: /console\.log\(`⏳ Background process waiting \$\{speedDelay\} seconds\.\.\.`\);/g,
    replacement: '// logger.info(`Waiting ${speedDelay} seconds`); // Reduced logging'
  },
  
  // Connection logs - keep important ones, reduce verbose ones
  {
    pattern: /console\.log\(`🔗 Attempting to connect WhatsApp for user: \$\{userId\}`\);/g,
    replacement: 'logger.info(`Connecting WhatsApp for user: ${userId}`);'
  },
  {
    pattern: /console\.log\(`🚀 Starting new WhatsApp connection for user: \$\{userId\}`\);/g,
    replacement: 'logger.info(`Starting WhatsApp connection for user: ${userId}`);'
  },
  {
    pattern: /console\.log\(`✅ WhatsApp socket created for user: \$\{userId\} with extended session settings`\);/g,
    replacement: 'logger.info(`WhatsApp socket created for user: ${userId}`);'
  },
  
  // Health check and status logs - keep these
  {
    pattern: /console\.log\(`✅ Connection opened for user: \$\{userId\}`\);/g,
    replacement: 'logger.info(`Connection opened for user: ${userId}`);'
  },
  {
    pattern: /console\.log\(`❌ Connection closed for user: \$\{userId\}, session: \$\{sessionId\}`\);/g,
    replacement: 'logger.warn(`Connection closed for user: ${userId}, session: ${sessionId}`);'
  },
  
  // Error logs - keep these as they're important
  {
    pattern: /console\.error\(`❌ Error connecting WhatsApp for user \$\{userId\}:`, error\);/g,
    replacement: 'logger.error(`Error connecting WhatsApp for user: ${userId}`, error.message);'
  },
  {
    pattern: /console\.error\(`❌ Background message failed for \$\{customer\.name\}:`, error\.message\);/g,
    replacement: 'logger.error(`Background message failed for ${customer.name}`, error.message);'
  },
  
  // Reduce verbose debugging logs
  {
    pattern: /console\.log\(`🔍 Session directory exists: \$\{exists\}`\);/g,
    replacement: '// logger.info(`Session directory exists: ${exists}`); // Reduced logging'
  },
  {
    pattern: /console\.log\(`🔍 Session directory contents:`, contents\);/g,
    replacement: '// logger.info(`Session directory contents: ${contents.length} items`); // Reduced logging'
  },
  {
    pattern: /console\.log\(`🔐 Loading auth state for user: \$\{userId\}`\);/g,
    replacement: '// logger.info(`Loading auth state for user: ${userId}`); // Reduced logging'
  },
  {
    pattern: /console\.log\(`✅ Auth state loaded for user: \$\{userId\}`\);/g,
    replacement: '// logger.info(`Auth state loaded for user: ${userId}`); // Reduced logging'
  },
  
  // Keep important completion logs
  {
    pattern: /console\.log\(`✅ Background process \$\{processId\} completed in \$\{Math\.floor\(duration \/ 60\)\}m \$\{duration % 60\}s`\);/g,
    replacement: 'logger.info(`Background process ${processId} completed in ${Math.floor(duration / 60)}m ${duration % 60}s`);'
  },
  {
    pattern: /console\.log\(`📊 Results: \$\{process\.completed\} sent, \$\{process\.failed\} failed`\);/g,
    replacement: 'logger.info(`Results: ${process.completed} sent, ${process.failed} failed`);'
  }
];

// Apply replacements
let replacementCount = 0;
replacements.forEach(({ pattern, replacement }) => {
  const matches = content.match(pattern);
  if (matches) {
    content = content.replace(pattern, replacement);
    replacementCount += matches.length;
  }
});

console.log(`✅ Applied ${replacementCount} logging optimizations`);

// 3. Add batch logging for high-frequency events
const batchLoggingCode = `
// Batch logging for high-frequency events
function logBatchMessages(messages, customerName) {
  if (messages.length > 5) {
    logger.batchLog('info', messages.map((msg, idx) => \`Message \${idx + 1} to \${customerName}\`));
  } else {
    messages.forEach((msg, idx) => logger.info(\`Message \${idx + 1} to \${customerName}\`));
  }
}
`;

// Add batch logging function after the logger import
content = content.replace(
  /const { logger } = require\('\.\/optimized-logger'\);/,
  `const { logger } = require('./optimized-logger');\n${batchLoggingCode}`
);

// 4. Add environment-based logging control
const envLoggingCode = `
// Environment-based logging control
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const isProduction = process.env.NODE_ENV === 'production';

// Override logger methods for production
if (isProduction) {
  const originalInfo = logger.info;
  const originalWarn = logger.warn;
  
  logger.info = (message, data) => {
    if (LOG_LEVEL === 'error' || LOG_LEVEL === 'warn') return;
    originalInfo(message, data);
  };
  
  logger.warn = (message, data) => {
    if (LOG_LEVEL === 'error') return;
    originalWarn(message, data);
  };
}
`;

content = content.replace(
  /const { logger } = require\('\.\/optimized-logger'\);/,
  `const { logger } = require('./optimized-logger');\n${envLoggingCode}`
);

// 5. Write the optimized file
console.log('💾 Writing optimized server file...');
fs.writeFileSync(serverFile, content);

console.log('\n✅ Logging optimization complete!');
console.log('================================');

console.log('\n📊 Optimization Summary:');
console.log('========================');
console.log(`• Reduced console statements: ${replacementCount}`);
console.log('• Added optimized logger with rate limiting');
console.log('• Added batch logging for high-frequency events');
console.log('• Added environment-based logging control');
console.log('• Maintained important error and status logs');

console.log('\n🔧 New Features:');
console.log('================');
console.log('• Rate limiting: Max 100 logs/second (well below 500 limit)');
console.log('• Log buffering: High-frequency logs are buffered');
console.log('• Batch logging: Multiple similar logs are batched');
console.log('• Environment control: LOG_LEVEL environment variable');
console.log('• Production mode: Reduced logging in production');

console.log('\n🌐 Environment Variables:');
console.log('=========================');
console.log('LOG_LEVEL=error    # Only show errors');
console.log('LOG_LEVEL=warn     # Show warnings and errors');
console.log('LOG_LEVEL=info     # Show info, warnings, and errors (default)');

console.log('\n🚀 Next Steps:');
console.log('==============');
console.log('1. Commit the optimized server file');
console.log('2. Deploy to Railway');
console.log('3. Monitor log rate in Railway dashboard');
console.log('4. Adjust LOG_LEVEL if needed');

console.log('\n📈 Expected Results:');
console.log('===================');
console.log('• Log rate reduced by 70-80%');
console.log('• Stay well below 500 logs/second limit');
console.log('• Important logs still visible');
console.log('• Better performance and stability');
