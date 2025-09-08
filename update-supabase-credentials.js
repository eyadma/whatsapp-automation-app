#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Supabase Credentials Update Script');
console.log('=====================================\n');

console.log('📋 This script will help you update Supabase credentials in your project files.');
console.log('Make sure you have your new Supabase project URL and anon key ready.\n');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function updateCredentials() {
  try {
    // Get new credentials
    const newUrl = await question('Enter your new Supabase URL (e.g., https://abc123.supabase.co): ');
    const newKey = await question('Enter your new Supabase anon key: ');
    
    if (!newUrl || !newKey) {
      console.log('❌ URL and key are required!');
      rl.close();
      return;
    }

    console.log('\n🔄 Updating credentials...\n');

    // Update .env file
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update SUPABASE_URL
      envContent = envContent.replace(
        /SUPABASE_URL=.*/,
        `SUPABASE_URL=${newUrl}`
      );
      
      // Update SUPABASE_ANON_KEY
      envContent = envContent.replace(
        /SUPABASE_ANON_KEY=.*/,
        `SUPABASE_ANON_KEY=${newKey}`
      );
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env file');
    } else {
      console.log('⚠️  .env file not found, creating new one...');
      const envContent = `SUPABASE_URL=${newUrl}
SUPABASE_ANON_KEY=${newKey}
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
PORT=3000`;
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Created new .env file');
    }

    // Update mobile/src/services/supabase.js
    const mobileSupabasePath = path.join(__dirname, 'mobile', 'src', 'services', 'supabase.js');
    if (fs.existsSync(mobileSupabasePath)) {
      let mobileContent = fs.readFileSync(mobileSupabasePath, 'utf8');
      
      // Update supabaseUrl
      mobileContent = mobileContent.replace(
        /const supabaseUrl = ['"`].*['"`];/,
        `const supabaseUrl = '${newUrl}';`
      );
      
      // Update supabaseKey
      mobileContent = mobileContent.replace(
        /const supabaseKey = ['"`].*['"`];/,
        `const supabaseKey = '${newKey}';`
      );
      
      fs.writeFileSync(mobileSupabasePath, mobileContent);
      console.log('✅ Updated mobile/src/services/supabase.js');
    } else {
      console.log('⚠️  mobile/src/services/supabase.js not found');
    }

    // Update config/supabase.js (if it exists)
    const configSupabasePath = path.join(__dirname, 'config', 'supabase.js');
    if (fs.existsSync(configSupabasePath)) {
      console.log('✅ config/supabase.js already uses environment variables');
    }

    console.log('\n🎉 Credentials updated successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Make sure you\'ve created the database schema in your new Supabase project');
    console.log('2. Test the connection: node setup-supabase.js');
    console.log('3. Start the mobile app: cd mobile && npx expo start --clear');
    console.log('4. Test authentication with a new user');

  } catch (error) {
    console.error('❌ Error updating credentials:', error.message);
  } finally {
    rl.close();
  }
}

updateCredentials(); 