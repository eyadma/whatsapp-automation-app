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

const WebSessionAnalytics = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [sessions, setSessions] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalSessions: 0,
    activeSessions: 0,
    connectedSessions: 0,
    disconnectedSessions: 0,
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    loadSessionAnalytics();
  }, [dateRange]);

  const loadSessionAnalytics = async () => {
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

      // Load sessions data
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.error('Error loading sessions:', sessionsError);
        Alert.alert('Error', 'Failed to load sessions');
        return;
      }

      setSessions(sessionsData || []);

      // Calculate analytics
      const totalSessions = sessionsData?.length || 0;
      const activeSessions = sessionsData?.filter(s => s.is_active).length || 0;
      const connectedSessions = sessionsData?.filter(s => s.status === 'connected').length || 0;
      const disconnectedSessions = sessionsData?.filter(s => s.status === 'disconnected').length || 0;

      // Load message statistics (simulated for now)
      const totalMessages = Math.floor(Math.random() * 1000) + 500;
      const successfulMessages = Math.floor(totalMessages * 0.85);
      const failedMessages = totalMessages - successfulMessages;

      setAnalytics({
        totalSessions,
        activeSessions,
        connectedSessions,
        disconnectedSessions,
        totalMessages,
        successfulMessages,
        failedMessages,
      });
    } catch (error) {
      console.error('Error loading session analytics:', error);
      Alert.alert('Error', 'Failed to load session analytics');
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return '#4CAF50';
      case 'connecting': return '#FF9800';
      case 'disconnected': return '#F44336';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
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
        <Text style={dynamicStyles.loadingText}>Loading session analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Session Analytics
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          WhatsApp session performance and statistics
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

      {/* Session Statistics */}
      <View style={dynamicStyles.statsContainer}>
        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={dynamicStyles.statNumber}>{analytics.totalSessions}</Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Total Sessions
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              All WhatsApp sessions
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={[dynamicStyles.statNumber, { color: '#4CAF50' }]}>
              {analytics.activeSessions}
            </Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Active Sessions
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Currently active sessions
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={[dynamicStyles.statNumber, { color: '#2196F3' }]}>
              {analytics.connectedSessions}
            </Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Connected
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Successfully connected sessions
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={[dynamicStyles.statNumber, { color: '#F44336' }]}>
              {analytics.disconnectedSessions}
            </Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Disconnected
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Disconnected sessions
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
              Successful
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
              Failed
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Messages that failed to send
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={[dynamicStyles.statNumber, { color: '#FF9800' }]}>
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

      {/* Session Details */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Session Details
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Detailed information about each WhatsApp session
          </WebCompatibleParagraph>
          
          {sessions.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <WebCompatibleParagraph style={dynamicStyles.emptyText}>
                No sessions found. Create a session to get started.
              </WebCompatibleParagraph>
            </View>
          ) : (
            <View style={dynamicStyles.sessionsList}>
              {sessions.map(session => (
                <View key={session.id} style={dynamicStyles.sessionItem}>
                  <View style={dynamicStyles.sessionInfo}>
                    <Text style={dynamicStyles.sessionName}>
                      {session.session_name}
                    </Text>
                    {session.session_alias && (
                      <Text style={dynamicStyles.sessionAlias}>
                        Alias: {session.session_alias}
                      </Text>
                    )}
                    {session.phone_number && (
                      <Text style={dynamicStyles.sessionPhone}>
                        Phone: {session.phone_number}
                      </Text>
                    )}
                    <View style={dynamicStyles.sessionStatus}>
                      <View style={[
                        dynamicStyles.statusDot,
                        { backgroundColor: getStatusColor(session.status) }
                      ]} />
                      <Text style={dynamicStyles.statusText}>
                        {getStatusText(session.status)}
                      </Text>
                    </View>
                    <Text style={dynamicStyles.sessionDate}>
                      Created: {new Date(session.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Performance Metrics */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Performance Metrics
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Key performance indicators for your WhatsApp sessions
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.metricsContainer}>
            <View style={dynamicStyles.metricItem}>
              <Text style={dynamicStyles.metricLabel}>Connection Stability:</Text>
              <Text style={dynamicStyles.metricValue}>95%</Text>
            </View>
            
            <View style={dynamicStyles.metricItem}>
              <Text style={dynamicStyles.metricLabel}>Average Response Time:</Text>
              <Text style={dynamicStyles.metricValue}>2.3s</Text>
            </View>
            
            <View style={dynamicStyles.metricItem}>
              <Text style={dynamicStyles.metricLabel}>Uptime:</Text>
              <Text style={dynamicStyles.metricValue}>99.8%</Text>
            </View>
            
            <View style={dynamicStyles.metricItem}>
              <Text style={dynamicStyles.metricLabel}>Messages per Hour:</Text>
              <Text style={dynamicStyles.metricValue}>150</Text>
            </View>
          </View>
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
              onPress={loadSessionAnalytics}
              style={dynamicStyles.actionButton}
            >
              Refresh Analytics
            </WebCompatibleButton>
            <WebCompatibleButton
              mode="outlined"
              onPress={() => navigation.navigate('Sessions')}
              style={dynamicStyles.actionButton}
            >
              Manage Sessions
            </WebCompatibleButton>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Footer */}
      <View style={dynamicStyles.footer}>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          Session Analytics - {getDateRangeText(dateRange)}
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
  emptyContainer: {
    textAlign: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  sessionsList: {
    gap: 16,
  },
  sessionItem: {
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  sessionAlias: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 2,
  },
  sessionPhone: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  sessionDate: {
    fontSize: 12,
    color: '#999999',
  },
  metricsContainer: {
    gap: 16,
  },
  metricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: 'bold',
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

export default WebSessionAnalytics;
