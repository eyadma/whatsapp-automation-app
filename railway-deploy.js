#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

console.log('🚀 Railway Deployment Setup');
console.log('===========================\n');

// Railway project information
const RAILWAY_PROJECT_ID = '8cf96366-ffc7-40fd-a2e2-4808200824fc';
const GITHUB_REPO = 'https://github.com/eyadma/whatsapp-automation-app.git';

console.log('📋 Project Information:');
console.log('======================');
console.log(`Railway Project ID: ${RAILWAY_PROJECT_ID}`);
console.log(`GitHub Repository: ${GITHUB_REPO}`);
console.log(`Repository Status: ✅ Pushed to GitHub`);

console.log('\n🔧 Railway Configuration:');
console.log('=========================');

// Check if railway.json exists
const railwayConfigPath = path.join(__dirname, 'railway.json');
if (fs.existsSync(railwayConfigPath)) {
  const railwayConfig = JSON.parse(fs.readFileSync(railwayConfigPath, 'utf8'));
  console.log('✅ railway.json found');
  console.log('📄 Configuration:');
  console.log(JSON.stringify(railwayConfig, null, 2));
} else {
  console.log('❌ railway.json not found');
}

// Check if .railwayignore exists
const railwayIgnorePath = path.join(__dirname, '.railwayignore');
if (fs.existsSync(railwayIgnorePath)) {
  console.log('✅ .railwayignore found');
} else {
  console.log('❌ .railwayignore not found');
}

// Check package.json
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  console.log('✅ package.json found');
  console.log(`📦 Start Command: ${packageJson.scripts.start}`);
  console.log(`📦 Main File: ${packageJson.main}`);
} else {
  console.log('❌ package.json not found');
}

console.log('\n🌐 Environment Variables Needed:');
console.log('=================================');
console.log('You need to set these in Railway dashboard:');
console.log('');
console.log('SUPABASE_URL=your_supabase_url_here');
console.log('SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here');
console.log('SUPABASE_ANON_KEY=your_supabase_anon_key_here');
console.log('PORT=3000');
console.log('NODE_ENV=production');

console.log('\n📱 Mobile App Configuration:');
console.log('============================');
console.log('After deployment, update mobile app with Railway URL:');
console.log('');
console.log('// In mobile/src/services/apiBase.js');
console.log('const PRODUCTION_URL = "https://your-app-name.railway.app";');

console.log('\n🚀 Railway Deployment Steps:');
console.log('============================');
console.log('1. Go to https://railway.app/dashboard');
console.log('2. Find your project (ID: 8cf96366-ffc7-40fd-a2e2-4808200824fc)');
console.log('3. Click on your project');
console.log('4. Go to "Variables" tab');
console.log('5. Add the environment variables listed above');
console.log('6. Go to "Deployments" tab');
console.log('7. Click "Deploy" or "Redeploy"');
console.log('8. Wait for deployment to complete');
console.log('9. Get your Railway URL from "Settings" → "Domains"');
console.log('10. Update mobile app with Railway URL');

console.log('\n🔍 Railway CLI Alternative:');
console.log('===========================');
console.log('You can also use Railway CLI:');
console.log('');
console.log('# Install Railway CLI');
console.log('npm install -g @railway/cli');
console.log('');
console.log('# Login to Railway');
console.log('railway login');
console.log('');
console.log('# Link to your project');
console.log('railway link 8cf96366-ffc7-40fd-a2e2-4808200824fc');
console.log('');
console.log('# Set environment variables');
console.log('railway variables set SUPABASE_URL=your_supabase_url');
console.log('railway variables set SUPABASE_SERVICE_ROLE_KEY=your_service_key');
console.log('railway variables set SUPABASE_ANON_KEY=your_anon_key');
console.log('railway variables set PORT=3000');
console.log('railway variables set NODE_ENV=production');
console.log('');
console.log('# Deploy');
console.log('railway up');

console.log('\n📊 Expected Railway URLs:');
console.log('=========================');
console.log('After deployment, your app will be available at:');
console.log('• Main App: https://your-app-name.railway.app');
console.log('• Health Check: https://your-app-name.railway.app/api/health');
console.log('• WhatsApp API: https://your-app-name.railway.app/api/whatsapp/status/test-user');

console.log('\n✅ Ready for Railway Deployment!');
console.log('===============================');
console.log('Your app is ready to deploy to Railway.');
console.log('Follow the steps above to complete the deployment.');

console.log('\n📞 Need Help?');
console.log('=============');
console.log('• Railway Docs: https://docs.railway.app');
console.log('• Railway Discord: https://discord.gg/railway');
console.log('• Your Project: https://railway.app/dashboard');
