import React, { useState, useEffect, useContext } from "react";
import { View, Text, ActivityIndicator, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Provider as PaperProvider, MD3LightTheme, MD3DarkTheme } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Contacts from 'expo-contacts';
import ContactsPermission from "./src/components/ContactsPermission";
// Import screens
import LoginScreen from "./src/screens/LoginScreen";
import AdminDashboard from "./src/screens/AdminDashboard";
import UserManagement from "./src/screens/UserManagement";
import AdminTemplateManagement from './src/screens/AdminTemplateManagement';
import AdminAnalytics from './src/screens/AdminAnalytics';
import AdminSettings from './src/screens/AdminSettings';
import WhatsAppScreen from "./src/screens/WhatsAppScreen";
import CustomersScreen from "./src/screens/CustomersScreen";
import AddCustomerScreen from "./src/screens/AddCustomerScreen";
import VCardScreen from "./src/screens/VCardScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import EnhancedMessageScreen from "./src/screens/EnhancedMessageScreen";
import AddETAScreen from "./src/screens/AddETAScreen";
import SimpleSessionManagementScreen from "./src/screens/SimpleSessionManagementScreen";
import SessionAnalyticsScreen from "./src/screens/SessionAnalyticsScreen";

// Import context and utilities
import { AppContext } from "./src/context/AppContext";
import { supabase } from "./src/services/supabase";
import { getTranslation } from "./src/utils/translations";

// Import web-compatible app for web platform
import WebApp from "./src/web/WebApp";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Main App Tab Navigator (for regular users)
const MainAppTabs = () => {
  const { t, theme, userId } = useContext(AppContext);
  const [timeRestrictionStatus, setTimeRestrictionStatus] = useState(null);
  const [loadingRestrictions, setLoadingRestrictions] = useState(true);

  useEffect(() => {
    const checkTimeRestrictions = async () => {
      if (!userId) return;
      
      try {
        setLoadingRestrictions(true);
        const { timeRestrictionsAPI } = await import('./src/services/timeRestrictionsAPI');
        const result = await timeRestrictionsAPI.getTimeRestrictionStatus(userId);
        
        if (result.success) {
          setTimeRestrictionStatus(result.data);
        } else {
          console.error('Error checking time restrictions:', result.error);
          // Default to showing Messages tab if there's an error
          setTimeRestrictionStatus({ canSendMessages: true });
        }
      } catch (error) {
        console.error('Error loading time restrictions:', error);
        // Default to showing Messages tab if there's an error
        setTimeRestrictionStatus({ canSendMessages: true });
      } finally {
        setLoadingRestrictions(false);
      }
    };

    checkTimeRestrictions();
    
    // Check every 10 minutes to update restrictions (also checked when Messages tab is pressed)
    const interval = setInterval(checkTimeRestrictions, 600000);
    return () => clearInterval(interval);
  }, [userId]);

  // Show loading state while checking restrictions
  if (loadingRestrictions) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme === "dark" ? "#121212" : "#ffffff" }}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={{ marginTop: 10, color: theme === "dark" ? "#fff" : "#000" }}>Loading...</Text>
      </View>
    );
  }

  // Determine if Messages tab should be shown
  const showMessagesTab = timeRestrictionStatus?.canSendMessages !== false;

  // If Messages tab is hidden, show a custom screen with time restriction info
  const MessagesScreen = showMessagesTab ? EnhancedMessageScreen : () => {
    const TimeRestrictionMessage = require('./src/components/TimeRestrictionMessage').default;
    return (
      <TimeRestrictionMessage 
        timeRestrictionStatus={timeRestrictionStatus}
        onRefresh={async () => {
          try {
            setLoadingRestrictions(true);
            const { timeRestrictionsAPI } = await import('./src/services/timeRestrictionsAPI');
            const result = await timeRestrictionsAPI.getTimeRestrictionStatus(userId);
            
            if (result.success) {
              setTimeRestrictionStatus(result.data);
            }
          } catch (error) {
            console.error('Error refreshing time restrictions:', error);
          } finally {
            setLoadingRestrictions(false);
          }
        }}
      />
    );
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "WhatsApp") {
            iconName = focused ? "logo-whatsapp" : "chatbubble-outline";
          } else if (route.name === "Customers") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "Messages") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          } else if (route.name === "Settings") {
            iconName = focused ? "settings" : "settings-outline";
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#25D366",
        tabBarInactiveTintColor: theme === "dark" ? "#888" : "gray",
        tabBarStyle: {
          backgroundColor: theme === "dark" ? "#1a1a1a" : "#ffffff",
          borderTopColor: theme === "dark" ? "#333" : "#e0e0e0",
        },
        headerStyle: {
          backgroundColor: "#25D366",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      })}
    >
      <Tab.Screen name="WhatsApp" component={WhatsAppScreen} options={{ title: t("whatsappConnection") }} />
      <Tab.Screen name="Customers" component={CustomersScreen} options={{ title: t("manageCustomers") }} />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen} 
        options={{ 
          title: showMessagesTab ? t("sendMessages") : "Messages (Restricted)"
        }}
        listeners={{
          tabPress: async () => {
            // Check time restrictions when Messages tab is pressed
            try {
              console.log('🔄 Messages tab pressed - checking time restrictions...');
              const { timeRestrictionsAPI } = await import('./src/services/timeRestrictionsAPI');
              const result = await timeRestrictionsAPI.getTimeRestrictionStatus(userId);
              
              if (result.success) {
                setTimeRestrictionStatus(result.data);
                console.log('✅ Time restrictions updated on tab press');
              }
            } catch (error) {
              console.error('Error checking time restrictions on tab press:', error);
            }
          }
        }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings") }} />
    </Tab.Navigator>
  );
};

// Admin Stack Navigator
const AdminStack = () => {
  const { theme } = useContext(AppContext);
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: "#25D366",
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
        cardStyle: {
          backgroundColor: theme === "dark" ? "#121212" : "#ffffff",
        },
      }}
    >
      <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ headerShown: false }} />
      <Stack.Screen name="UserManagement" component={UserManagement} options={{ title: "User Management" }} />
      <Stack.Screen name="AdminTemplateManagement" component={AdminTemplateManagement} options={{ title: "Template Management" }} />
      <Stack.Screen name="AdminAnalytics" component={AdminAnalytics} options={{ title: "Analytics" }} />
      <Stack.Screen name="AdminSettings" component={AdminSettings} options={{ title: "Settings" }} />
      <Stack.Screen name="Sessions" component={SimpleSessionManagementScreen} options={{ title: "WhatsApp Sessions" }} />
      <Stack.Screen name="SessionAnalytics" component={SessionAnalyticsScreen} options={{ title: "Session Analytics" }} />
    </Stack.Navigator>
  );
};

export default function App() {
  // Use web-compatible app for web platform
  if (Platform.OS === 'web') {
    return <WebApp />;
  }

  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("light");

  // Load user preferences function
  const loadUserPreferences = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem("userLanguage");
      const savedTheme = await AsyncStorage.getItem("userTheme");

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
    // Check authentication status
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Use the actual Supabase user ID (UUID)
        setUserId(user.id);
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
      } else {
        setUserId(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Helper function to ensure clean userId
  const getCleanUserId = (userId) => {
    if (!userId) return null;
    // Remove any "user_" prefix if present
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
    return null; // Or a loading screen
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
            // Session management
            activeSessionId: null, // This will be managed by SessionManagementScreen
            setActiveSessionId: () => {}, // Placeholder
            getActiveSession: () => null, // Placeholder
          }}
        >
        <NavigationContainer>
          <Stack.Navigator 
            screenOptions={{ 
              headerShown: false,
              cardStyle: {
                backgroundColor: theme === "dark" ? "#121212" : "#ffffff",
              },
            }}
          >
            {!user ? (
              // Auth screens
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : (
              // App screens based on user role
              <>
                {user.user_metadata?.role === "admin" ? (
                  <Stack.Screen name="AdminStack" component={AdminStack} />
                ) : (
                  <>
                    <Stack.Screen name="MainApp" component={MainAppTabs} />
                    <Stack.Screen 
                      name="AddCustomer" 
                      component={AddCustomerScreen} 
                      options={{ 
                        headerShown: true, 
                        title: t("Add Customer"),
                        headerStyle: { backgroundColor: "#25D366" },
                        headerTintColor: "#fff",
                        headerTitleStyle: { fontWeight: "bold" },
                      }} 
                    />
                    <Stack.Screen 
                      name="AddETA" 
                      component={AddETAScreen} 
                      options={{ 
                        headerShown: true, 
                        title: t("Add ETA"),
                        headerStyle: { backgroundColor: "#25D366" },
                        headerTintColor: "#fff",
                        headerTitleStyle: { fontWeight: "bold" },
                      }} 
                    />
                    <Stack.Screen 
                      name="VCard" 
                      component={VCardScreen} 
                      options={{ 
                        headerShown: true, 
                        title: t("vCardGenerator"),
                        headerStyle: { backgroundColor: "#25D366" },
                        headerTintColor: "#fff",
                        headerTitleStyle: { fontWeight: "bold" },
                      }} 
                    />
                    <Stack.Screen 
                      name="Sessions" 
                      component={SimpleSessionManagementScreen} 
                      options={{ 
                        headerShown: true, 
                        title: "WhatsApp Sessions",
                        headerStyle: { backgroundColor: "#25D366" },
                        headerTintColor: "#fff",
                        headerTitleStyle: { fontWeight: "bold" },
                      }} 
                    />
                    <Stack.Screen 
                      name="SessionAnalytics" 
                      component={SessionAnalyticsScreen} 
                      options={{ 
                        headerShown: true, 
                        title: "Session Analytics",
                        headerStyle: { backgroundColor: "#25D366" },
                        headerTintColor: "#fff",
                        headerTitleStyle: { fontWeight: "bold" },
                      }} 
                    />
                  </>
                )}
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </AppContext.Provider>
    </PaperProvider>
  );
}
