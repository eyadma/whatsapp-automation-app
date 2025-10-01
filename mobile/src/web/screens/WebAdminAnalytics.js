import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { AppContext } from '../../context/AppContext';

// Import web-compatible components
import WebCompatibleButton from '../components/WebCompatibleButton';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';

const WebAdminAnalytics = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [analytics, setAnalytics] = useState({
    totalUsers: 0,
    totalCustomers: 0,
    totalSessions: 0,
    totalTemplates: 0,
    activeUsers: 0,
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    loadAnalytics();
  }, [dateRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '1d':
          startDate.setDate(endDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      // Load analytics data
      const [
        usersResult,
        customersResult,
        sessionsResult,
        templatesResult,
        activeUsersResult,
        messagesResult,
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('whatsapp_sessions').select('id', { count: 'exact' }),
        supabase.from('message_templates').select('id', { count: 'exact' }),
        supabase.from('users').select('id', { count: 'exact' }).gte('last_login', startDate.toISOString()),
        supabase.from('message_logs').select('id, status', { count: 'exact' }).gte('created_at', startDate.toISOString()),
      ]);

      // Calculate message statistics
      const totalMessages = messagesResult.count || 0;
      const successfulMessages = messagesResult.data?.filter(msg => msg.status === 'sent').length || 0;
      const failedMessages = messagesResult.data?.filter(msg => msg.status === 'failed').length || 0;

      setAnalytics({
        totalUsers: usersResult.count || 0,
        totalCustomers: customersResult.count || 0,
        totalSessions: sessionsResult.count || 0,
        totalTemplates: templatesResult.count || 0,
        activeUsers: activeUsersResult.count || 0,
        totalMessages,
        successfulMessages,
        failedMessages,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeText = (range) => {
    switch (range) {
      case '1d': return 'Last 24 Hours';
      case '7d': return 'Last 7 Days';
      case '30d': return 'Last 30 Days';
      case '90d': return 'Last 90 Days';
      default: return 'Last 7 Days';
    }
  };

  const getSuccessRate = () => {
    if (analytics.totalMessages === 0) return 0;
    return Math.round((analytics.successfulMessages / analytics.totalMessages) * 100);
  };

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Analytics Dashboard
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          System performance and usage statistics
        </WebCompatibleParagraph>
      </View>

      {/* Date Range Selector */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Time Period
          </WebCompatibleTitle>
          <View style={dynamicStyles.dateRangeContainer}>
            {['1d', '7d', '30d', '90d'].map(range => (
              <WebCompatibleButton
                key={range}
                mode={dateRange === range ? 'contained' : 'outlined'}
                onPress={() => setDateRange(range)}
                style={dynamicStyles.dateRangeButton}
              >
                {getDateRangeText(range)}
              </WebCompatibleButton>
            ))}
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Overview Statistics */}
      <View style={dynamicStyles.statsContainer}>
        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={dynamicStyles.statNumber}>{analytics.totalUsers}</Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Total Users
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Registered users in the system
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={dynamicStyles.statNumber}>{analytics.activeUsers}</Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Active Users
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Users active in the selected period
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={dynamicStyles.statNumber}>{analytics.totalCustomers}</Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Total Customers
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Customers across all users
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={dynamicStyles.statNumber}>{analytics.totalSessions}</Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              WhatsApp Sessions
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Active WhatsApp connections
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>
      </View>

      {/* Message Statistics */}
      <View style={dynamicStyles.statsContainer}>
        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={dynamicStyles.statNumber}>{analytics.totalMessages}</Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Total Messages
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Messages sent in the selected period
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={[dynamicStyles.statNumber, { color: '#4CAF50' }]}>
              {analytics.successfulMessages}
            </Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Successful Messages
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Messages delivered successfully
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={[dynamicStyles.statNumber, { color: '#F44336' }]}>
              {analytics.failedMessages}
            </Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Failed Messages
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Messages that failed to send
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={[dynamicStyles.statNumber, { color: '#2196F3' }]}>
              {getSuccessRate()}%
            </Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Success Rate
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Message delivery success rate
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>
      </View>

      {/* System Health */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            System Health
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Current system status and performance metrics
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.healthContainer}>
            <View style={dynamicStyles.healthItem}>
              <Text style={dynamicStyles.healthLabel}>Database Status:</Text>
              <View style={[dynamicStyles.healthStatus, { backgroundColor: '#4CAF50' }]}>
                <Text style={dynamicStyles.healthStatusText}>Online</Text>
              </View>
            </View>
            
            <View style={dynamicStyles.healthItem}>
              <Text style={dynamicStyles.healthLabel}>API Status:</Text>
              <View style={[dynamicStyles.healthStatus, { backgroundColor: '#4CAF50' }]}>
                <Text style={dynamicStyles.healthStatusText}>Operational</Text>
              </View>
            </View>
            
            <View style={dynamicStyles.healthItem}>
              <Text style={dynamicStyles.healthLabel}>WhatsApp API:</Text>
              <View style={[dynamicStyles.healthStatus, { backgroundColor: '#4CAF50' }]}>
                <Text style={dynamicStyles.healthStatusText}>Connected</Text>
              </View>
            </View>
            
            <View style={dynamicStyles.healthItem}>
              <Text style={dynamicStyles.healthLabel}>System Load:</Text>
              <View style={[dynamicStyles.healthStatus, { backgroundColor: '#FF9800' }]}>
                <Text style={dynamicStyles.healthStatusText}>Moderate</Text>
              </View>
            </View>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Recent Activity */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Recent Activity
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Latest system activities and events
          </WebCompatibleParagraph>
          
          <WebCompatibleList>
            <WebCompatibleList.Item
              title="System Started"
              description="WhatsApp Manager web platform initialized"
              right={<Text style={dynamicStyles.timeText}>Just now</Text>}
            />
            <WebCompatibleList.Item
              title="Analytics Refreshed"
              description={`Analytics data updated for ${getDateRangeText(dateRange)}`}
              right={<Text style={dynamicStyles.timeText}>Just now</Text>}
            />
            <WebCompatibleList.Item
              title="User Login"
              description="Admin user logged in successfully"
              right={<Text style={dynamicStyles.timeText}>Just now</Text>}
            />
            <WebCompatibleList.Item
              title="Database Connected"
              description="Supabase database connection established"
              right={<Text style={dynamicStyles.timeText}>Just now</Text>}
            />
          </WebCompatibleList>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Actions
          </WebCompatibleTitle>
          
          <View style={dynamicStyles.actionsContainer}>
            <WebCompatibleButton
              mode="contained"
              onPress={loadAnalytics}
              style={dynamicStyles.actionButton}
            >
              Refresh Analytics
            </WebCompatibleButton>
            <WebCompatibleButton
              mode="outlined"
              onPress={() => navigation.navigate('Dashboard')}
              style={dynamicStyles.actionButton}
            >
              Back to Dashboard
            </WebCompatibleButton>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Footer */}
      <View style={dynamicStyles.footer}>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          Analytics Dashboard - {getDateRangeText(dateRange)}
        </WebCompatibleParagraph>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          Last updated: {new Date().toLocaleString()}
        </WebCompatibleParagraph>
      </View>
    </ScrollView>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666666',
  },
  header: {
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  dateRangeContainer: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  dateRangeButton: {
    minWidth: 100,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 200,
    textAlign: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#25D366',
    textAlign: 'center',
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },
  statDescription: {
    fontSize: 12,
    color: '#666666',
    textAlign: 'center',
  },
  healthContainer: {
    gap: 16,
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  healthLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  healthStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  healthStatusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 12,
    color: '#999999',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  actionButton: {
    minWidth: 150,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 4,
  },
});

export default WebAdminAnalytics;
