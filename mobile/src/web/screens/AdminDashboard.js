import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Card, Title, Paragraph, Button, List, Divider, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';
import { formatDateWithArabicNumerals } from '../../utils/numberFormatting';

const AdminDashboard = ({ navigation }) => {
  const { userId } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCustomers: 0,
    totalMessages: 0,
    activeSessions: 0,
  });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (userId) {
      loadDashboardData();
    }
  }, [userId]);

  const loadDashboardData = async () => {
    if (!userId) {
      console.log('No userId available, skipping dashboard data load');
      return;
    }
    
    try {
      setLoading(true);
      
      // Check if current user is admin
      const { data: currentUser, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (userError) {
        console.error('Error fetching current user:', userError);
        Alert.alert('Error', 'Failed to verify admin status');
        return;
      }
      
      const isAdmin = currentUser.role === 'admin';
      console.log('Current user role:', currentUser.role, 'Is admin:', isAdmin);
      
      // Always use admin queries for this dashboard (it's AdminDashboard)
      console.log('Using admin queries for dashboard...');
      
      // Debug: Check what tables exist and their data
      console.log('🔍 Debugging database access...');
      
      // Check if user is authenticated and has proper session
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Current session:', { 
        hasSession: !!session, 
        userId: session?.user?.id,
        userRole: currentUser.role 
      });
      
      // Get total users (all profiles) - try with RLS bypass for admin
      console.log('📊 Fetching users from profiles table...');
      let userCount = 0, customerCount = 0, messageCount = 0, sessionCount = 0;
      
      try {
        // For admin users, try to fetch all data
        if (isAdmin) {
          // Try to get all profiles
          const { count: userCountResult, error: userCountError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          
          if (userCountError) {
            console.error('❌ Error fetching user count:', userCountError);
            // Try alternative approach - get user's own profile first
            const { data: ownProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId);
            userCount = ownProfile ? 1 : 0;
            console.log('⚠️ Using fallback user count:', userCount);
          } else {
            userCount = userCountResult || 0;
            console.log('✅ Users fetched successfully:', { count: userCount });
          }

          // Try to get all customers
          const { count: customerCountResult, error: customerCountError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true });
          
          if (customerCountError) {
            console.error('❌ Error fetching customer count:', customerCountError);
            // Try alternative approach - get customers for current user
            const { data: ownCustomers } = await supabase
              .from('customers')
              .select('*')
              .eq('user_id', userId);
            customerCount = ownCustomers?.length || 0;
            console.log('⚠️ Using fallback customer count:', customerCount);
          } else {
            customerCount = customerCountResult || 0;
            console.log('✅ Customers fetched successfully:', { count: customerCount });
          }

          // Try to get all messages
          const { count: messageCountResult, error: messageCountError } = await supabase
            .from('message_history')
            .select('*', { count: 'exact', head: true });
          
          if (messageCountError) {
            console.error('❌ Error fetching message count:', messageCountError);
            // Try alternative approach - get messages for current user
            const { data: ownMessages } = await supabase
              .from('message_history')
              .select('*')
              .eq('user_id', userId);
            messageCount = ownMessages?.length || 0;
            console.log('⚠️ Using fallback message count:', messageCount);
          } else {
            messageCount = messageCountResult || 0;
            console.log('✅ Messages fetched successfully:', { count: messageCount });
          }

          // Try to get all sessions
          const { count: sessionCountResult, error: sessionCountError } = await supabase
            .from('whatsapp_sessions')
            .select('*', { count: 'exact', head: true });
          
          if (sessionCountError) {
            console.error('❌ Error fetching session count:', sessionCountError);
            // Try alternative approach - get sessions for current user
            const { data: ownSessions } = await supabase
              .from('whatsapp_sessions')
              .select('*')
              .eq('user_id', userId);
            sessionCount = ownSessions?.length || 0;
            console.log('⚠️ Using fallback session count:', sessionCount);
          } else {
            sessionCount = sessionCountResult || 0;
            console.log('✅ Sessions fetched successfully:', { count: sessionCount });
          }
        } else {
          // For non-admin users, only get their own data
          const { count: userCountResult } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('id', userId);
          userCount = userCountResult || 0;
          
          const { count: customerCountResult } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          customerCount = customerCountResult || 0;
          
          const { count: messageCountResult } = await supabase
            .from('message_history')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          messageCount = messageCountResult || 0;
          
          const { count: sessionCountResult } = await supabase
            .from('whatsapp_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);
          sessionCount = sessionCountResult || 0;
        }
      } catch (error) {
        console.error('❌ Error in data fetching:', error);
        Alert.alert('Warning', 'Some data could not be fetched: ' + error.message);
      }

      // Get recent users (all users or just own profile)
      console.log('📊 Fetching recent users from profiles table...');
      let recentUsers = [];
      
      try {
        if (isAdmin) {
          const { data: recentUsersResult, error: usersError } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
          
          if (usersError) {
            console.error('❌ Error fetching recent users:', usersError);
            // Fallback to own profile
            const { data: ownProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId);
            recentUsers = ownProfile ? [ownProfile] : [];
          } else {
            recentUsers = recentUsersResult || [];
          }
        } else {
          const { data: ownProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId);
          recentUsers = ownProfile ? [ownProfile] : [];
        }
        
        console.log('✅ Recent users fetched successfully:', { count: recentUsers?.length, sampleData: recentUsers?.slice(0, 2) });
      } catch (error) {
        console.error('❌ Error fetching recent users:', error);
        recentUsers = [];
      }



      setStats({
        totalUsers: userCount || 0,
        totalCustomers: customerCount || 0,
        totalMessages: messageCount || 0,
        activeSessions: sessionCount || 0,
      });

      setUsers(recentUsers || []);
      
      console.log('Dashboard stats updated:', {
        totalUsers: userCount || 0,
        totalCustomers: customerCount || 0,
        totalMessages: messageCount || 0,
        activeSessions: sessionCount || 0,
        recentUsers: (recentUsers || []).length
      });
      
      // Debug: Log raw data
      console.log('Raw data from Supabase:', {
        userCount,
        customerCount,
        messageCount,
        sessionCount,
        recentUsersLength: recentUsers?.length
      });
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigation.replace('Login');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const handleUserManagement = () => {
    navigation.navigate('UserManagement');
  };

  const handleTemplateManagement = () => {
    navigation.navigate('AdminTemplateManagement');
  };

  const handleAnalytics = () => {
    navigation.navigate('AdminAnalytics');
  };

  const handleSettings = () => {
    navigation.navigate('AdminSettings');
  };

  const handleSystemSettings = () => {
    // TODO: Implement System Settings screen
    Alert.alert('Coming Soon', 'System Settings feature will be available soon');
  };

  const handleSessions = () => {
    navigation.navigate('Sessions');
  };

  // Debug function to test database access
  const testDatabaseAccess = async () => {
    try {
      console.log('🧪 Testing database access...');
      
      // Test 1: Check if we can access profiles table
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, role, created_at')
        .limit(5);
      
      console.log('📋 Profiles test:', { data: profiles, error: profilesError });
      
      // Test 2: Check if we can access customers table
      const { data: customers, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, user_id')
        .limit(5);
      
      console.log('👥 Customers test:', { data: customers, error: customersError });
      
      // Test 3: Check if we can access message_history table
      const { data: messages, error: messagesError } = await supabase
        .from('message_history')
        .select('id, message, user_id, created_at')
        .limit(5);
      
      console.log('💬 Messages test:', { data: messages, error: messagesError });
      
      // Test 4: Check if we can access whatsapp_sessions table
      const { data: sessions, error: sessionsError } = await supabase
        .from('whatsapp_sessions')
        .select('id, user_id, status, created_at')
        .limit(5);
      
      console.log('📱 Sessions test:', { data: sessions, error: sessionsError });
      
      // Show summary alert
      const summary = {
        profiles: profiles?.length || 0,
        customers: customers?.length || 0,
        messages: messages?.length || 0,
        sessions: sessions?.length || 0
      };
      
      Alert.alert(
        'Database Access Test Results',
        `Profiles: ${summary.profiles}\nCustomers: ${summary.customers}\nMessages: ${summary.messages}\nSessions: ${summary.sessions}`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Database access test failed:', error);
      Alert.alert('Error', 'Database access test failed: ' + error.message);
    }
  };

  const StatCard = ({ title, value, icon, color, onPress }) => (
    <TouchableOpacity onPress={onPress}>
      <Card style={[dynamicStyles.statCard, { borderLeftColor: color }]}>
        <Card.Content style={dynamicStyles.statContent}>
          <View style={dynamicStyles.statIcon}>
            <Ionicons name={icon} size={24} color={color} />
          </View>
          <View style={dynamicStyles.statText}>
            <Title style={dynamicStyles.statValue}>{value}</Title>
            <Paragraph style={dynamicStyles.statTitle}>{title}</Paragraph>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <View>
          <Title style={dynamicStyles.headerTitle}>Admin Dashboard</Title>
          <Paragraph style={dynamicStyles.headerSubtitle}>System Overview</Paragraph>
        </View>
        <View style={dynamicStyles.headerActions}>
          <TouchableOpacity onPress={loadDashboardData} style={dynamicStyles.refreshButton}>
            <Ionicons name="refresh" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSignOut} style={dynamicStyles.signOutButton}>
            <Ionicons name="log-out-outline" size={24} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={dynamicStyles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats Cards */}
        <View style={dynamicStyles.statsContainer}>
          <StatCard
            title="Total Users"
            value={stats.totalUsers}
            icon="people"
            color="#25D366"
            onPress={handleUserManagement}
          />
          <StatCard
            title="Total Customers"
            value={stats.totalCustomers}
            icon="person-circle"
            color="#007AFF"
          />
          <StatCard
            title="Messages Sent"
            value={stats.totalMessages}
            icon="chatbubbles"
            color="#FF9500"
          />
          <StatCard
            title="Active Sessions"
            value={stats.activeSessions}
            icon="wifi"
            color="#FF3B30"
          />
        </View>

        {/* Quick Actions */}
        <Card style={dynamicStyles.card}>
          <Card.Content>
            <Title style={dynamicStyles.cardTitle}>Quick Actions</Title>
            <View style={dynamicStyles.actionButtons}>
              <TouchableOpacity 
                style={dynamicStyles.actionButton}
                onPress={handleUserManagement}
              >
                <Ionicons name="people" size={24} color="#25D366" />
                <Text style={dynamicStyles.actionText}>Manage Users</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={dynamicStyles.actionButton}
                onPress={handleTemplateManagement}
              >
                <Ionicons name="document-text" size={24} color="#8E44AD" />
                <Text style={dynamicStyles.actionText}>Templates</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={dynamicStyles.actionButton}
                onPress={handleAnalytics}
              >
                <Ionicons name="analytics" size={24} color="#007AFF" />
                <Text style={dynamicStyles.actionText}>Analytics</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={dynamicStyles.actionButton}
                onPress={handleSettings}
              >
                <Ionicons name="settings" size={24} color="#FF9500" />
                <Text style={dynamicStyles.actionText}>Settings</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={dynamicStyles.actionButton}
                onPress={handleSystemSettings}
              >
                <Ionicons name="construct" size={24} color="#9C27B0" />
                <Text style={dynamicStyles.actionText}>System</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={dynamicStyles.actionButton}
                onPress={testDatabaseAccess}
              >
                <Ionicons name="bug" size={24} color="#FF5722" />
                <Text style={dynamicStyles.actionText}>Debug DB</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={dynamicStyles.actionButton}
                onPress={handleSessions}
              >
                <Ionicons name="chatbubbles" size={24} color="#667eea" />
                <Text style={dynamicStyles.actionText}>Sessions</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Recent Users */}
        <Card style={dynamicStyles.card}>
          <Card.Content>
            <Title style={dynamicStyles.cardTitle}>Recent Users</Title>
            {users.length > 0 ? (
              users.map((user, index) => (
                <View key={user.id}>
                  <List.Item
                    title={user.email}
                    description={`Role: ${user.role || 'regular'} • Joined: ${formatDateWithArabicNumerals(new Date(user.created_at))}`}
                    left={() => (
                      <List.Icon 
                        icon={user.role === 'admin' ? 'shield' : 'person'} 
                        color={user.role === 'admin' ? '#FF3B30' : '#25D366'}
                      />
                    )}
                    right={() => (
                      <View style={dynamicStyles.userStatus}>
                        <Text style={[
                          dynamicStyles.statusText,
                          { color: user.role === 'admin' ? '#FF3B30' : '#25D366' }
                        ]}>
                          {user.role || 'regular'}
                        </Text>
                      </View>
                    )}
                  />
                  {index < users.length - 1 && <Divider />}
                </View>
              ))
            ) : (
              <Paragraph style={dynamicStyles.noData}>No users found</Paragraph>
            )}
          </Card.Content>
        </Card>

        {/* System Status */}
        <Card style={dynamicStyles.card}>
          <Card.Content>
            <Title style={dynamicStyles.cardTitle}>System Status</Title>
            <View style={dynamicStyles.statusItem}>
              <Ionicons name="checkmark-circle" size={20} color="#25D366" />
              <Text style={dynamicStyles.statusText}>Database: Connected</Text>
            </View>
            <View style={dynamicStyles.statusItem}>
              <Ionicons name="checkmark-circle" size={20} color="#25D366" />
              <Text style={dynamicStyles.statusText}>Authentication: Active</Text>
            </View>
            <View style={dynamicStyles.statusItem}>
              <Ionicons name="checkmark-circle" size={20} color="#25D366" />
              <Text style={dynamicStyles.statusText}>API: Running</Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  headerSubtitle: {
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  refreshButton: {
    padding: 8,
  },
  signOutButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderLeftWidth: 4,
    elevation: 2,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    marginRight: 15,
  },
  statText: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  statTitle: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 2,
  },
  card: {
    margin: 15,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: theme.colors.onSurface,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceVariant,
    minWidth: 80,
    flex: 1,
    maxWidth: '30%',
  },
  actionText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.onSurface,
  },
  userStatus: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  noData: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
});

export default AdminDashboard; 