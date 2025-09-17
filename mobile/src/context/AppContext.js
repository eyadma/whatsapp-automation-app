import { createContext } from 'react';

// Create context with default values
export const AppContext = createContext({
  userId: null,
  user: null,
  language: 'en',
  theme: 'light',
  // Session management
  activeSessionId: null,
  // Helper function to ensure clean userId
  getCleanUserId: (userId) => {
    if (!userId) return null;
    // Remove any "user_" prefix if present
    return userId.replace(/^user_/, '');
  },
  // Helper function to get translation
  t: (key) => key,
  // Helper function to set language
  setLanguage: () => {},
  // Helper function to set theme
  setTheme: () => {},
  // Helper function to set user ID
  setUserId: () => {},
  // Helper function to set user
  setUser: () => {},
  // Session management functions
  setActiveSessionId: () => {},
  getActiveSession: () => null,
}); 