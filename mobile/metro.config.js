const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

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
  // Custom resolver for problematic packages
  resolveRequest: (context, moduleName, platform) => {
    // Handle all Supabase packages
    if (moduleName.startsWith('@supabase/')) {
      const packageName = moduleName.replace('@supabase/', '');
      const mainPath = path.resolve(__dirname, `node_modules/@supabase/${packageName}/dist/main/index.js`);
      try {
        if (require('fs').existsSync(mainPath)) {
          return {
            filePath: mainPath,
            type: 'sourceFile',
          };
        }
      } catch (e) {
        // Fall through to default resolution
      }
    }
    
    if (moduleName === '@react-native-picker/picker') {
      return {
        filePath: path.resolve(__dirname, 'node_modules/@react-native-picker/picker/dist/commonjs/index.js'),
        type: 'sourceFile',
      };
    }
    
    
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config; 