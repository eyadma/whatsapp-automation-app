import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Dimensions,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  List,
  Divider,
  Chip,
  TextInput,
  SegmentedButtons,
  Portal,
  Modal,
  ProgressBar,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { AppContext } from '../context/AppContext';

const { width } = Dimensions.get('window');

const AdminSettings = ({ navigation }) => {
  const { userId, t, language, setLanguage, theme, setTheme } = useContext(AppContext);
  const paperTheme = useTheme();
  const [loading, setLoading] = useState(false);
  const [systemStats, setSystemStats] = useState({});
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [systemHealth, setSystemHealth] = useState({
    database: 'healthy',
    api: 'healthy',
    storage: 'healthy',
    auth: 'healthy',
  });

  useEffect(() => {
    loadSystemStats();
    checkSystemHealth();
  }, []);

  const loadSystemStats = async () => {
    try {
      setLoading(true);
      
      // Get system statistics
      const [users, customers, messages, sessions] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('message_history').select('*', { count: 'exact', head: true }),
        supabase.from('whatsapp_sessions').select('*', { count: 'exact', head: true }),
      ]);

      // Get storage usage (mock data)
      const storageUsage = {
        total: 1024, // MB
        used: 256,
        available: 768,
      };

      setSystemStats({
        totalUsers: users.count || 0,
        totalCustomers: customers.count || 0,
        totalMessages: messages.count || 0,
        activeSessions: sessions.count || 0,
        storageUsage,
      });
    } catch (error) {
      console.error('Error loading system stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkSystemHealth = async () => {
    // Mock system health check
    setTimeout(() => {
      setSystemHealth({
        database: Math.random() > 0.1 ? 'healthy' : 'warning',
        api: Math.random() > 0.1 ? 'healthy' : 'warning',
        storage: Math.random() > 0.1 ? 'healthy' : 'warning',
        auth: Math.random() > 0.1 ? 'healthy' : 'warning',
      });
    }, 1000);
  };

  const handleBackupSystem = async () => {
    setShowBackupModal(true);
    setBackupProgress(0);

    // Simulate backup process
    const interval = setInterval(() => {
      setBackupProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setShowBackupModal(false);
            Alert.alert('Success', 'System backup completed successfully');
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleToggleMaintenance = async () => {
    try {
      setMaintenanceMode(!maintenanceMode);
      Alert.alert(
        'Maintenance Mode',
        `System ${!maintenanceMode ? 'entered' : 'exited'} maintenance mode`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error toggling maintenance mode:', error);
      Alert.alert('Error', 'Failed to toggle maintenance mode');
    }
  };

  const handleClearCache = async () => {
    Alert.alert(
      'Clear Cache',
      'Are you sure you want to clear all system cache?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'System cache cleared successfully');
          },
        },
      ]
    );
  };

  const handleResetSystem = async () => {
    Alert.alert(
      'Reset System',
      'This will reset all system settings to default. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'System settings reset to default');
          },
        },
      ]
    );
  };

  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy':
        return '#4CAF50';
      case 'warning':
        return '#FF9800';
      case 'error':
        return '#F44336';
      default:
        return '#95A5A6';
    }
  };

  const getHealthIcon = (status) => {
    switch (status) {
      case 'healthy':
        return 'checkmark-circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const renderSystemOverview = () => (
    <Card style={dynamicStyles.card}>
      <Card.Content>
        <Title style={dynamicStyles.cardTitle}>System Overview</Title>
        <View style={dynamicStyles.statsGrid}>
          <View style={dynamicStyles.statItem}>
            <Ionicons name="people" size={24} color="#1976D2" />
            <Text style={dynamicStyles.statValue}>{systemStats.totalUsers}</Text>
            <Text style={dynamicStyles.statLabel}>Users</Text>
          </View>
          <View style={dynamicStyles.statItem}>
            <Ionicons name="person-circle" size={24} color="#7B1FA2" />
            <Text style={dynamicStyles.statValue}>{systemStats.totalCustomers}</Text>
            <Text style={dynamicStyles.statLabel}>Customers</Text>
          </View>
          <View style={dynamicStyles.statItem}>
            <Ionicons name="chatbubbles" size={24} color="#388E3C" />
            <Text style={dynamicStyles.statValue}>{systemStats.totalMessages}</Text>
            <Text style={dynamicStyles.statLabel}>Messages</Text>
          </View>
          <View style={dynamicStyles.statItem}>
            <Ionicons name="wifi" size={24} color="#F57C00" />
            <Text style={dynamicStyles.statValue}>{systemStats.activeSessions}</Text>
            <Text style={dynamicStyles.statLabel}>Sessions</Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderSystemHealth = () => (
    <Card style={dynamicStyles.card}>
      <Card.Content>
        <Title style={dynamicStyles.cardTitle}>System Health</Title>
        {Object.entries(systemHealth).map(([service, status]) => (
          <View key={service} style={dynamicStyles.healthItem}>
            <View style={dynamicStyles.healthInfo}>
              <Ionicons
                name={getHealthIcon(status)}
                size={20}
                color={getHealthColor(status)}
              />
              <Text style={dynamicStyles.healthService}>
                {service.charAt(0).toUpperCase() + service.slice(1)}
              </Text>
            </View>
            <Chip
              mode="outlined"
              textStyle={{ color: getHealthColor(status) }}
              style={[dynamicStyles.healthChip, { borderColor: getHealthColor(status) }]}
            >
              {status}
            </Chip>
          </View>
        ))}
      </Card.Content>
    </Card>
  );

  const renderStorageUsage = () => (
    <Card style={dynamicStyles.card}>
      <Card.Content>
        <Title style={dynamicStyles.cardTitle}>Storage Usage</Title>
        <View style={dynamicStyles.storageInfo}>
          <View style={dynamicStyles.storageBar}>
            <ProgressBar
              progress={systemStats.storageUsage?.used / systemStats.storageUsage?.total || 0}
              color="#1976D2"
              style={dynamicStyles.progressBar}
            />
            <Text style={dynamicStyles.storageText}>
              {systemStats.storageUsage?.used || 0} MB / {systemStats.storageUsage?.total || 0} MB
            </Text>
          </View>
          <Text style={dynamicStyles.storageLabel}>
            {((systemStats.storageUsage?.used / systemStats.storageUsage?.total) * 100 || 0).toFixed(1)}% used
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  const renderSystemActions = () => (
    <Card style={dynamicStyles.card}>
      <Card.Content>
        <Title style={dynamicStyles.cardTitle}>System Actions</Title>
        
        <List.Item
          title="Backup System"
          description="Create a complete system backup"
          left={(props) => <List.Icon {...props} icon="backup-restore" />}
          right={() => (
            <Button mode="outlined" onPress={handleBackupSystem}>
              Backup
            </Button>
          )}
        />
        <Divider />
        
        <List.Item
          title="Maintenance Mode"
          description="Enable/disable system maintenance"
          left={(props) => <List.Icon {...props} icon="wrench" />}
          right={() => (
            <Switch
              value={maintenanceMode}
              onValueChange={handleToggleMaintenance}
            />
          )}
        />
        <Divider />
        
        <List.Item
          title="Clear Cache"
          description="Clear all system cache"
          left={(props) => <List.Icon {...props} icon="delete-sweep" />}
          right={() => (
            <Button mode="outlined" onPress={handleClearCache}>
              Clear
            </Button>
          )}
        />
        <Divider />
        
        <List.Item
          title="Reset System"
          description="Reset all settings to default"
          left={(props) => <List.Icon {...props} icon="refresh" />}
          right={() => (
            <Button mode="outlined" onPress={handleResetSystem} textColor="#F44336">
              Reset
            </Button>
          )}
        />
      </Card.Content>
    </Card>
  );

  const renderAppSettings = () => (
    <Card style={dynamicStyles.card}>
      <Card.Content>
        <Title style={dynamicStyles.cardTitle}>Application Settings</Title>
        
        <View style={dynamicStyles.settingItem}>
          <Text style={dynamicStyles.settingLabel}>Language</Text>
          <SegmentedButtons
            value={language}
            onValueChange={setLanguage}
            buttons={[
              { value: 'en', label: 'English' },
              { value: 'he', label: 'עברית' },
              { value: 'ar', label: 'العربية' },
            ]}
            style={dynamicStyles.segmentedButtons}
          />
        </View>
        
        <View style={dynamicStyles.settingItem}>
          <Text style={dynamicStyles.settingLabel}>Theme</Text>
          <SegmentedButtons
            value={theme}
            onValueChange={setTheme}
            buttons={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'auto', label: 'Auto' },
            ]}
            style={dynamicStyles.segmentedButtons}
          />
        </View>
      </Card.Content>
    </Card>
  );

  // Create dynamic styles based on theme
  const dynamicStyles = createStyles(paperTheme);

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Title style={dynamicStyles.headerTitle}>Admin Settings</Title>
        <Paragraph style={dynamicStyles.headerSubtitle}>System configuration and management</Paragraph>
      </View>

      <ScrollView style={dynamicStyles.scrollView}>
        {renderSystemOverview()}
        {renderSystemHealth()}
        {renderStorageUsage()}
        {renderSystemActions()}
        {renderAppSettings()}
      </ScrollView>

      <Portal>
        <Modal
          visible={showBackupModal}
          onDismiss={() => setShowBackupModal(false)}
          contentContainerStyle={dynamicStyles.modal}
        >
          <Card>
            <Card.Content>
              <Title style={dynamicStyles.modalTitle}>System Backup</Title>
              <Paragraph style={dynamicStyles.modalSubtitle}>
                Creating system backup...
              </Paragraph>
              <ProgressBar
                progress={backupProgress / 100}
                color="#1976D2"
                style={dynamicStyles.modalProgressBar}
              />
              <Text style={dynamicStyles.progressText}>{backupProgress}%</Text>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
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
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 15,
    backgroundColor: theme.colors.surface,
  },
  cardTitle: {
    fontSize: 18,
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  healthItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  healthInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthService: {
    fontSize: 16,
    marginLeft: 10,
    color: theme.colors.onSurface,
  },
  healthChip: {
    height: 24,
  },
  storageInfo: {
    marginTop: 10,
  },
  storageBar: {
    marginBottom: 10,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 5,
  },
  storageText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  storageLabel: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  settingItem: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 10,
  },
  segmentedButtons: {
    marginTop: 5,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 10,
  },
  modalSubtitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: theme.colors.onSurfaceVariant,
  },
  modalProgressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 10,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
  },
});

export default AdminSettings; 