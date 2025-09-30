import React, { useState, useEffect, useContext } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";

// Import web-compatible screens (copied from mobile)
import LoginScreen from "./screens/LoginScreen";
import AdminDashboard from "./screens/AdminDashboard";
import UserManagement from "./screens/UserManagement";
import AdminTemplateManagement from './screens/AdminTemplateManagement';
import AdminAnalytics from './screens/AdminAnalytics';
import AdminSettings from './screens/AdminSettings';
import WhatsAppScreen from "./screens/WhatsAppScreen";
import CustomersScreen from "./screens/CustomersScreen";
import VCardScreen from "./screens/VCardScreen";
import SettingsScreen from "./screens/SettingsScreen";
import MinimalSettingsScreen from "./screens/MinimalSettingsScreen";
import EnhancedMessageScreen from "./screens/EnhancedMessageScreen";
import AddCustomerScreen from "./screens/AddCustomerScreen";
import AddETAScreen from "./screens/AddETAScreen";
import SimpleSessionManagementScreen from "./screens/SimpleSessionManagementScreen";
import SessionAnalyticsScreen from "./screens/SessionAnalyticsScreen";

// Import context and utilities
import { AppContext } from "../context/AppContext";
import { supabase } from "../services/supabase";
import { getTranslation } from "../utils/translations";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Simple Error Boundary to catch runtime render errors (prevents blank screen)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("❌ Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: '#666', marginBottom: 16 }}>
            {String(this.state.error?.message || this.state.error || 'Unknown error')}
          </Text>
          <Text style={{ color: '#25D366' }} onPress={() => window.location.reload()}>Reload</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// Main App Tab Navigator (for regular users) - Web Compatible
const WebMainAppTabs = () => {
  const { t, theme, userId } = useContext(AppContext);
  
  // Simplified - no time restrictions for web to avoid loading issues
  const showMessagesTab = true;

  // Full Tab Navigator - all 5 screens enabled
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'WhatsApp') {
            iconName = focused ? 'logo-whatsapp' : 'logo-whatsapp-outline';
          } else if (route.name === 'Customers') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'VCard') {
            iconName = focused ? 'card' : 'card-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#25D366',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
          borderTopColor: theme === 'dark' ? '#333' : '#e0e0e0',
        },
        headerStyle: {
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
        },
        headerTintColor: theme === 'dark' ? '#fff' : '#000',
      })}
    >
      {/* WhatsApp tab temporarily disabled to test */}
      {/* Customers tab temporarily disabled to test */}
      {/* Messages tab temporarily disabled to test */}
      {/* VCard tab temporarily disabled to test */}
      <Tab.Screen name="Settings" component={MinimalSettingsScreen} options={{ title: t("settings") || "Settings" }} />
    </Tab.Navigator>
  );
};

// Admin Stack Navigator - Web Compatible
const WebAdminStack = () => {
  const { t, theme } = useContext(AppContext);
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme === 'dark' ? '#1e1e1e' : '#fff',
        },
        headerTintColor: theme === 'dark' ? '#fff' : '#000',
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ title: "Admin Dashboard" }} />
      <Stack.Screen name="UserManagement" component={UserManagement} options={{ title: t("userManagement") || "User Management" }} />
      <Stack.Screen name="TemplateManagement" component={AdminTemplateManagement} options={{ title: "Template Management" }} />
      <Stack.Screen name="Analytics" component={AdminAnalytics} options={{ title: "Analytics" }} />
      <Stack.Screen name="AdminSettings" component={AdminSettings} options={{ title: t("settings") || "Settings" }} />
      <Stack.Screen name="Sessions" component={SimpleSessionManagementScreen} options={{ title: "Session Management" }} />
      <Stack.Screen name="SessionAnalytics" component={SessionAnalyticsScreen} options={{ title: "Session Analytics" }} />
    </Stack.Navigator>
  );
};

// Main Web App Component
export default function WebApp() {
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("light");
  const [isAdmin, setIsAdmin] = useState(false);

  // Load user preferences function
  const loadUserPreferences = async () => {
    try {
      // For web, use localStorage directly
      const savedLanguage = localStorage.getItem("userLanguage");
      const savedTheme = localStorage.getItem("userTheme");

      if (savedLanguage) setLanguage(savedLanguage);
      if (savedTheme) setTheme(savedTheme);
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  };

  // Load user preferences on app start
  useEffect(() => {
    loadUserPreferences();
  }, []);

  useEffect(() => {
    checkAuth();
    
    // Safety timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn("⚠️ Loading timeout reached, forcing loading to false");
        setLoading(false);
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, []);

  const checkAuth = async () => {
    try {
      console.log("🔍 Checking authentication...");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      console.log("👤 User found:", user ? "Yes" : "No");
      setUser(user);

      if (user) {
        setUserId(user.id);
        console.log("🆔 User ID set:", user.id);
        // Check if user is admin
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();
          
          if (profileError) {
            console.warn("⚠️ Profile query error:", profileError);
            setIsAdmin(false);
          } else {
            const isAdminUser = profile?.is_admin || false;
            console.log("👑 Is admin:", isAdminUser);
            setIsAdmin(isAdminUser);
          }
        } catch (profileError) {
          console.warn("⚠️ Profile query exception:", profileError);
          setIsAdmin(false);
        }
      }
    } catch (error) {
      console.error("❌ Auth check error:", error);
    } finally {
      console.log("✅ Auth check complete, setting loading to false");
      setLoading(false);
    }
  };

  // Listen for auth changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth state change:", event, session ? "Session exists" : "No session");
      setUser(session?.user ?? null);

      if (session?.user) {
        setUserId(session.user.id);
        console.log("🆔 Auth state change - User ID set:", session.user.id);
        // Check if user is admin
        try {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            console.warn("⚠️ Auth state change - Profile query error:", profileError);
            setIsAdmin(false);
          } else {
            const isAdminUser = profile?.is_admin || false;
            console.log("👑 Auth state change - Is admin:", isAdminUser);
            setIsAdmin(isAdminUser);
          }
        } catch (profileError) {
          console.warn("⚠️ Auth state change - Profile query exception:", profileError);
          setIsAdmin(false);
        }
      } else {
        setUserId(null);
        setIsAdmin(false);
        console.log("🚪 User logged out");
      }

      console.log("✅ Auth state change complete, setting loading to false");
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Helper function to ensure clean userId
  const getCleanUserId = (userId) => {
    if (!userId) return null;
    return userId.replace(/^user_/, "");
  };

  // Helper function to get translation
  const t = (key) => getTranslation(key, language);

  // Theme configuration
  const getTheme = () => {
    if (theme === "dark") {
      return {
        ...MD3DarkTheme,
        colors: {
          ...MD3DarkTheme.colors,
          primary: "#25D366",
          secondary: "#128C7E",
        },
      };
    }
    return {
      ...MD3LightTheme,
      colors: {
        ...MD3LightTheme.colors,
        primary: "#25D366",
        secondary: "#128C7E",
      },
    };
  };

  if (loading) {
    console.log("⏳ App is loading...", "User:", user ? "exists" : "null", "Loading state:", loading);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme === "dark" ? "#121212" : "#ffffff" }}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={{ marginTop: 10, color: theme === "dark" ? "#fff" : "#000" }}>Loading...</Text>
        <Text style={{ marginTop: 5, color: theme === "dark" ? "#fff" : "#000", fontSize: 12 }}>
          {user ? "User authenticated, loading app..." : "Checking authentication..."}
        </Text>
      </View>
    );
  }

  const cleanUserId = getCleanUserId(userId);
  console.log("🎯 App render - User:", user ? "Logged in" : "Not logged in", "Admin:", isAdmin, "Clean User ID:", cleanUserId);

  return (
    <PaperProvider theme={getTheme()}>
      <AppContext.Provider
        value={{
          userId: cleanUserId,
          user,
          language,
          theme,
          getCleanUserId,
          t,
          setLanguage,
          setTheme,
          setUserId,
          setUser,
          isAdmin,
          // Session management
          activeSessionId: null,
          setActiveSessionId: () => {},
          getActiveSession: () => null,
        }}
      >
        <ErrorBoundary>
          <NavigationContainer>
            {user ? (
              isAdmin ? (
                <WebAdminStack />
              ) : (
                <WebMainAppTabs />
              )
            ) : (
              <Stack.Navigator>
                <Stack.Screen 
                  name="Login" 
                  component={LoginScreen} 
                  options={{ headerShown: false }} 
                />
              </Stack.Navigator>
            )}
          </NavigationContainer>
        </ErrorBoundary>
      </AppContext.Provider>
    </PaperProvider>
  );
}
