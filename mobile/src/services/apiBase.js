// Utility to resolve backend base URL across platforms
import { Platform } from 'react-native';

const LAN_IP = '192.168.0.113'; // update if your IP changes
const PORT = 3000;
const PRODUCTION_URL = 'https://whatsapp-automation-app-production.up.railway.app';

let cachedBaseUrl = null;

// Function to clear cached URL (useful for debugging)
export function clearCachedUrl() {
  cachedBaseUrl = null;
  console.log('🔄 Cleared cached URL');
}

export function getApiBaseUrl() {
  if (cachedBaseUrl) return cachedBaseUrl;
  
  // Use production URL if available
  if (PRODUCTION_URL && PRODUCTION_URL !== 'https://your-production-server.com') {
    return PRODUCTION_URL;
  }
  
  if (__DEV__) {
    // Always prioritize LAN IP for physical devices
    return `http://${LAN_IP}:${PORT}`;
  }
  
  return PRODUCTION_URL;
}

async function ping(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${url}/api/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    return true;
  } catch (e) {
    return false;
  }
}

export async function resolveApiBaseUrl() {
  if (cachedBaseUrl) {
    console.log('🚀 Using cached URL:', cachedBaseUrl);
    return cachedBaseUrl;
  }

  const candidates = [];
  
  // Add production URL first
  if (PRODUCTION_URL && PRODUCTION_URL !== 'https://your-production-server.com') {
    candidates.push(PRODUCTION_URL);
  }
  
  if (__DEV__) {
    // Always prioritize the LAN IP first for physical devices
    candidates.push(`http://${LAN_IP}:${PORT}`);
    
    if (Platform.OS === 'android') {
      candidates.push(`http://10.0.2.2:${PORT}`); // Android emulator
      candidates.push(`http://localhost:${PORT}`);
    } else if (Platform.OS === 'ios') {
      candidates.push(`http://localhost:${PORT}`); // iOS simulator
    } else {
      candidates.push(`http://localhost:${PORT}`);
    }
  } else {
    candidates.push(PRODUCTION_URL);
  }

  console.log('🔍 Testing URL candidates:', candidates);

  for (const url of candidates) {
    console.log('🧪 Testing URL:', url);
    const ok = await ping(url);
    console.log('✅ URL test result:', url, ok ? 'SUCCESS' : 'FAILED');
    if (ok) {
      cachedBaseUrl = url;
      console.log('🎯 Selected URL:', cachedBaseUrl);
      return cachedBaseUrl;
    }
  }
  // Fallback to guess
  cachedBaseUrl = getApiBaseUrl();
  console.log('⚠️ Using fallback URL:', cachedBaseUrl);
  return cachedBaseUrl;
} 