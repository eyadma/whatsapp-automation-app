const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure resolver to handle ES modules
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  unstable_conditionNames: ['react-native', 'browser', 'require'],
  // Exclude problematic files
  blockList: [
    /.*\/node_modules\/.*\/dist\/module\/.*\.js$/,
    /.*\/node_modules\/.*\/esm\/.*\.js$/,
  ],
};

module.exports = config; 