import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

// Use web-compatible app for web platform, regular app for mobile
const App = Platform.OS === 'web' 
  ? require('./src/web/WebApp').default 
  : require('./App').default;

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
