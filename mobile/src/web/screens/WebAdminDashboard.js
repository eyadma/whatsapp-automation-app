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

const WebAdminDashboard = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCustomers: 0,
    totalSessions: 0,
    totalTemplates: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Load user statistics
      const [usersResult, customersResult, sessionsResult, templatesResult] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('customers').select('id', { count: 'exact' }),
        supabase.from('whatsapp_sessions').select('id', { count: 'exact' }),
        supabase.from('message_templates').select('id', { count: 'exact' }),
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        totalCustomers: customersResult.count || 0,
        totalSessions: sessionsResult.count || 0,
        totalTemplates: templatesResult.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      Alert.alert('Error', 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Admin Dashboard
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Manage your WhatsApp messaging platform
        </WebCompatibleParagraph>
      </View>

      {/* Statistics Cards */}
      <View style={dynamicStyles.statsContainer}>
        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={dynamicStyles.statNumber}>{stats.totalUsers}</Text>
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
            <Text style={dynamicStyles.statNumber}>{stats.totalCustomers}</Text>
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
            <Text style={dynamicStyles.statNumber}>{stats.totalSessions}</Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              WhatsApp Sessions
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Active WhatsApp connections
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>

        <WebCompatibleCard style={dynamicStyles.statCard}>
          <WebCompatibleCard.Content>
            <Text style={dynamicStyles.statNumber}>{stats.totalTemplates}</Text>
            <WebCompatibleTitle style={dynamicStyles.statTitle}>
              Message Templates
            </WebCompatibleTitle>
            <WebCompatibleParagraph style={dynamicStyles.statDescription}>
              Available message templates
            </WebCompatibleParagraph>
          </WebCompatibleCard.Content>
        </WebCompatibleCard>
      </View>

      {/* Quick Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Quick Actions
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Common administrative tasks
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.actionsGrid}>
            <WebCompatibleButton
              mode="contained"
              onPress={() => navigation.navigate('UserManagement')}
              style={dynamicStyles.actionButton}
            >
              Manage Users
            </WebCompatibleButton>
            
            <WebCompatibleButton
              mode="contained"
              onPress={() => navigation.navigate('TemplateManagement')}
              style={dynamicStyles.actionButton}
            >
              Manage Templates
            </WebCompatibleButton>
            
            <WebCompatibleButton
              mode="contained"
              onPress={() => navigation.navigate('Analytics')}
              style={dynamicStyles.actionButton}
            >
              View Analytics
            </WebCompatibleButton>
            
            <WebCompatibleButton
              mode="contained"
              onPress={() => navigation.navigate('Settings')}
              style={dynamicStyles.actionButton}
            >
              System Settings
            </WebCompatibleButton>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* System Information */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            System Information
          </WebCompatibleTitle>
          <WebCompatibleParagraph style={dynamicStyles.sectionDescription}>
            Current system status and information
          </WebCompatibleParagraph>
          
          <View style={dynamicStyles.infoContainer}>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>App Version:</Text>
              <Text style={dynamicStyles.infoValue}>1.3.0</Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Platform:</Text>
              <Text style={dynamicStyles.infoValue}>Web</Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Database:</Text>
              <Text style={dynamicStyles.infoValue}>Supabase</Text>
            </View>
            <View style={dynamicStyles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Last Updated:</Text>
              <Text style={dynamicStyles.infoValue}>
                {new Date().toLocaleDateString()}
              </Text>
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
            Latest system activities and updates
          </WebCompatibleParagraph>
          
          <WebCompatibleList>
            <WebCompatibleList.Item
              title="System Started"
              description="WhatsApp Manager web platform initialized"
              right={<Text style={dynamicStyles.timeText}>Just now</Text>}
            />
            <WebCompatibleList.Item
              title="Dashboard Loaded"
              description="Admin dashboard statistics refreshed"
              right={<Text style={dynamicStyles.timeText}>Just now</Text>}
            />
            <WebCompatibleList.Item
              title="User Login"
              description="Admin user logged in successfully"
              right={<Text style={dynamicStyles.timeText}>Just now</Text>}
            />
          </WebCompatibleList>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Footer */}
      <View style={dynamicStyles.footer}>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          WhatsApp Manager Admin Dashboard
        </WebCompatibleParagraph>
        <WebCompatibleParagraph style={dynamicStyles.footerText}>
          Version 1.3.0 - Web Platform
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
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'center',
  },
  actionButton: {
    minWidth: 150,
    marginBottom: 8,
  },
  infoContainer: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '400',
  },
  timeText: {
    fontSize: 12,
    color: '#999999',
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

export default WebAdminDashboard;
