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

// Main App Tab Navigator (for regular users) - Web Compatible
const WebMainAppTabs = () => {
  const { t, theme, userId } = useContext(AppContext);
  const [timeRestrictionStatus, setTimeRestrictionStatus] = useState(null);
  const [loadingRestrictions, setLoadingRestrictions] = useState(true);

  useEffect(() => {
    const checkTimeRestrictions = async () => {
      if (!userId) return;
      
      try {
        setLoadingRestrictions(true);
        const { timeRestrictionsAPI } = await import('../services/timeRestrictionsAPI');
        const result = await timeRestrictionsAPI.getTimeRestrictionStatus(userId);
        
        if (result.success) {
          setTimeRestrictionStatus(result.data);
        } else {
          console.error('Error checking time restrictions:', result.error);
          setTimeRestrictionStatus({ canSendMessages: true });
        }
      } catch (error) {
        console.error('Error loading time restrictions:', error);
        setTimeRestrictionStatus({ canSendMessages: true });
      } finally {
        setLoadingRestrictions(false);
      }
    };

    checkTimeRestrictions();
    const interval = setInterval(checkTimeRestrictions, 600000);
    return () => clearInterval(interval);
  }, [userId]);

  if (loadingRestrictions) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme === "dark" ? "#121212" : "#ffffff" }}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={{ marginTop: 10, color: theme === "dark" ? "#fff" : "#000" }}>Loading...</Text>
      </View>
    );
  }

  const showMessagesTab = timeRestrictionStatus?.canSendMessages !== false;

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
      <Tab.Screen name="WhatsApp" component={WhatsAppScreen} options={{ title: t("whatsappConnection") }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ title: t("manageCustomers") }} />
      <Tab.Screen 
        name="Messages" 
        component={EnhancedMessageScreen} 
        options={{ 
          title: showMessagesTab ? t("sendMessages") : "Messages (Restricted)"
        }}
      />
      <Tab.Screen name="VCard" component={VCardScreen} options={{ title: t("vCard") }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings") }} />
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
      <Stack.Screen name="UserManagement" component={UserManagement} options={{ title: t("userManagement") }} />
      <Stack.Screen name="TemplateManagement" component={AdminTemplateManagement} options={{ title: "Template Management" }} />
      <Stack.Screen name="Analytics" component={AdminAnalytics} options={{ title: "Analytics" }} />
      <Stack.Screen name="AdminSettings" component={AdminSettings} options={{ title: t("settings") }} />
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
  }, []);

  const checkAuth = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        setUserId(user.id);
        // Check if user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        
        setIsAdmin(profile?.is_admin || false);
      }
    } catch (error) {
      console.error("Auth check error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Listen for auth changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        setUserId(session.user.id);
        // Check if user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        
        setIsAdmin(profile?.is_admin || false);
      } else {
        setUserId(null);
        setIsAdmin(false);
      }

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
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme === "dark" ? "#121212" : "#ffffff" }}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={{ marginTop: 10, color: theme === "dark" ? "#fff" : "#000" }}>Loading...</Text>
      </View>
    );
  }

  const cleanUserId = getCleanUserId(userId);

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
      </AppContext.Provider>
    </PaperProvider>
  );
}
