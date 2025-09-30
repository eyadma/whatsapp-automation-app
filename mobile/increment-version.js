#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('📱 Incrementing app version...\n');

// File paths
const appJsonPath = path.join(__dirname, 'app.json');
const buildGradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');

// Read current app.json
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const currentVersion = appJson.expo.version;
const currentVersionCode = appJson.expo.android.versionCode;

console.log(`📱 Current version: ${currentVersion}`);
console.log(`🔢 Current version code: ${currentVersionCode}`);

// Increment version
const versionParts = currentVersion.split('.');
const major = parseInt(versionParts[0]);
const minor = parseInt(versionParts[1]);
const patch = parseInt(versionParts[2]) + 1;
const newVersion = `${major}.${minor}.${patch}`;
const newVersionCode = currentVersionCode + 1;

console.log(`📱 New version: ${newVersion}`);
console.log(`🔢 New version code: ${newVersionCode}\n`);

// Update app.json
appJson.expo.version = newVersion;
appJson.expo.android.versionCode = newVersionCode;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
console.log('✅ Updated app.json');

// Update build.gradle
let buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');
buildGradleContent = buildGradleContent.replace(
    /versionCode \d+/,
    `versionCode ${newVersionCode}`
);
buildGradleContent = buildGradleContent.replace(
    /versionName "[^"]*"/,
    `versionName "${newVersion}"`
);
fs.writeFileSync(buildGradlePath, buildGradleContent);
console.log('✅ Updated build.gradle');

console.log('\n🎉 Version incremented successfully!');
console.log(`📱 Version: ${newVersion}`);
console.log(`🔢 Version Code: ${newVersionCode}`);
console.log('\n💡 Run "eas build --platform android --profile production" to build with the new version.');
