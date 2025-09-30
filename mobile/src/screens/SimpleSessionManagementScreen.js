import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Button,
  List,
  Divider,
  useTheme,
  ActivityIndicator,
  Chip,
  Modal,
  Portal,
  TextInput,
  Title,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { supabase } from '../services/supabase';

const SimpleSessionManagementScreen = ({ navigation }) => {
  const { userId, t } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    phoneNumber: '',
  });

  useEffect(() => {
    if (userId) {
      loadSessions();
    }
  }, [userId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      
      // Get user's sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);
      
      // Check connection status for each session
      if (sessionsData && sessionsData.length > 0) {
        checkConnectionStatuses(sessionsData);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const checkConnectionStatuses = async (sessionsList = sessions) => {
    try {
      const statusPromises = sessionsList.map(async (session) => {
        try {
          const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/whatsapp/status/${session.session_id}`);
          const data = await response.json();
          return {
            sessionId: session.session_id,
            connected: data.connected || false,
            status: data.status || 'disconnected'
          };
        } catch (error) {
          return {
            sessionId: session.session_id,
            connected: false,
            status: 'error'
          };
        }
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap = {};
      statuses.forEach(status => {
        statusMap[status.sessionId] = status;
      });
      
      setConnectionStatus(statusMap);
    } catch (error) {
      console.error('Error checking connection statuses:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleCreateSession = () => {
    // Reset form data
    setFormData({
      name: '',
      alias: '',
      phoneNumber: '',
    });
    setShowCreateModal(true);
  };

  const handleEditSession = (session) => {
    setEditingSession(session);
    setFormData({
      name: session.session_name || '',
      alias: session.session_alias || '',
      phoneNumber: session.phone_number || '',
    });
    setShowEditModal(true);
  };

  const createNewSession = async () => {
    // Validate form data
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Session name is required');
      return;
    }

    try {
      setLoading(true);
      
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Generate alias if not provided
      const alias = formData.alias.trim() || generateAlias(formData.name);
      
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .insert({
          session_id: sessionId,
          user_id: userId,
          session_name: formData.name.trim(),
          session_alias: alias,
          phone_number: formData.phoneNumber.trim() || null,
          connection_type: 'mobile',
          max_connections: 5,
          is_default: sessions.length === 0, // First session is default
          is_active: true,
          status: 'disconnected'
        })
        .select()
        .single();

      if (error) throw error;

      setShowCreateModal(false);
      Alert.alert('Success', 'New session created successfully!');
      loadSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create session: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateAlias = (name) => {
    if (!name) return 'S' + Math.random().toString(36).substr(2, 3).toUpperCase();
    
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 3).toUpperCase();
    }
    
    return words.map(word => word.charAt(0)).join('').toUpperCase();
  };

  const updateSession = async () => {
    // Validate form data
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Session name is required');
      return;
    }

    try {
      setLoading(true);
      
      // Generate alias if not provided
      const alias = formData.alias.trim() || generateAlias(formData.name);
      
      const { error } = await supabase
        .from('whatsapp_sessions')
        .update({
          session_name: formData.name.trim(),
          session_alias: alias,
          phone_number: formData.phoneNumber.trim() || null
        })
        .eq('session_id', editingSession.session_id)
        .eq('user_id', userId);

      if (error) throw error;

      setShowEditModal(false);
      setEditingSession(null);
      Alert.alert('Success', 'Session updated successfully!');
      loadSessions();
    } catch (error) {
      console.error('Error updating session:', error);
      Alert.alert('Error', 'Failed to update session: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = (session) => {
    Alert.alert(
      'Delete Session',
      `Are you sure you want to delete "${session.session_name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteSession(session.session_id) }
      ]
    );
  };

  const deleteSession = async (sessionId) => {
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('whatsapp_sessions')
        .delete()
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;

      Alert.alert('Success', 'Session deleted successfully!');
      loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
      Alert.alert('Error', 'Failed to delete session');
    } finally {
      setLoading(false);
    }
  };

  const handleSetDefault = async (sessionId) => {
    try {
      setLoading(true);
      
      // Remove default from all sessions
      await supabase
        .from('whatsapp_sessions')
        .update({ is_default: false })
        .eq('user_id', userId);

      // Set new default
      const { error } = await supabase
        .from('whatsapp_sessions')
        .update({ is_default: true })
        .eq('session_id', sessionId)
        .eq('user_id', userId);

      if (error) throw error;

      Alert.alert('Success', 'Default session updated!');
      loadSessions();
    } catch (error) {
      console.error('Error setting default session:', error);
      Alert.alert('Error', 'Failed to set default session');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (sessionId) => {
    const status = connectionStatus[sessionId];
    if (!status) return '#666';
    return status.connected ? '#25D366' : '#FF3B30';
  };

  const getStatusText = (sessionId) => {
    const status = connectionStatus[sessionId];
    if (!status) return 'Unknown';
    return status.connected ? 'Connected' : 'Disconnected';
  };

  if (loading && sessions.length === 0) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#25D366" />
        <Text style={dynamicStyles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={dynamicStyles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.header}>
            <Text style={dynamicStyles.title}>WhatsApp Sessions</Text>
            <Button
              mode="contained"
              onPress={handleCreateSession}
              icon="plus"
              compact
              loading={loading}
              disabled={loading}
            >
              New Session
            </Button>
          </View>
          <Text style={dynamicStyles.subtitle}>
            Manage your WhatsApp connections
          </Text>
        </Card.Content>
      </Card>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card style={dynamicStyles.card}>
          <Card.Content>
            <View style={dynamicStyles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#666" />
              <Text style={dynamicStyles.emptyTitle}>No Sessions</Text>
              <Text style={dynamicStyles.emptyText}>
                Create your first WhatsApp session to start messaging
              </Text>
              <Button
                mode="contained"
                onPress={handleCreateSession}
                icon="plus"
                style={dynamicStyles.emptyButton}
              >
                Create Session
              </Button>
            </View>
          </Card.Content>
        </Card>
      ) : (
        sessions.map((session, index) => (
          <Card key={session.session_id} style={dynamicStyles.card}>
            <Card.Content>
              <View style={dynamicStyles.sessionHeader}>
                <View style={dynamicStyles.sessionInfo}>
                  <Text style={dynamicStyles.sessionName}>
                    {session.session_name}
                    {session.is_default && (
                      <Chip 
                        mode="outlined" 
                        compact 
                        style={dynamicStyles.defaultChip}
                        textStyle={dynamicStyles.defaultChipText}
                      >
                        Default
                      </Chip>
                    )}
                  </Text>
                  <Text style={dynamicStyles.sessionId}>
                    ID: {session.session_id}
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
                  
                  <View style={dynamicStyles.statusContainer}>
                    <View 
                      style={[
                        dynamicStyles.statusDot, 
                        { backgroundColor: getStatusColor(session.session_id) }
                      ]} 
                    />
                    <Text style={dynamicStyles.statusText}>
                      {getStatusText(session.session_id)}
                    </Text>
                  </View>
                </View>
              </View>

              <Divider style={dynamicStyles.divider} />

              <View style={dynamicStyles.sessionActions}>
                {!session.is_default && (
                  <Button
                    mode="outlined"
                    onPress={() => handleSetDefault(session.session_id)}
                    icon="star"
                    compact
                    style={dynamicStyles.actionButton}
                  >
                    Set Default
                  </Button>
                )}
                
                <Button
                  mode="outlined"
                  onPress={() => handleEditSession(session)}
                  icon="pencil"
                  compact
                  style={dynamicStyles.actionButton}
                >
                  Edit
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={() => handleDeleteSession(session)}
                  icon="delete"
                  compact
                  style={[dynamicStyles.actionButton, dynamicStyles.deleteButton]}
                >
                  Delete
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))
      )}

      {/* Create Session Modal */}
      <Portal>
        <Modal
          visible={showCreateModal}
          onDismiss={() => setShowCreateModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <Card style={dynamicStyles.modalCard}>
            <Card.Content>
              <Title style={dynamicStyles.modalTitle}>Create New Session</Title>
              
              <TextInput
                label="Session Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                style={dynamicStyles.input}
                mode="outlined"
                placeholder="Enter session name"
              />
              
              <TextInput
                label="Alias (Optional)"
                value={formData.alias}
                onChangeText={(text) => setFormData({...formData, alias: text})}
                style={dynamicStyles.input}
                mode="outlined"
                placeholder="Enter alias or leave empty for auto-generation"
              />
              
              <TextInput
                label="Phone Number (Optional)"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({...formData, phoneNumber: text})}
                style={dynamicStyles.input}
                mode="outlined"
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
              
              <View style={dynamicStyles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setShowCreateModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={createNewSession}
                  loading={loading}
                  disabled={loading}
                  style={dynamicStyles.modalButton}
                >
                  Create Session
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      {/* Edit Session Modal */}
      <Portal>
        <Modal
          visible={showEditModal}
          onDismiss={() => {
            setShowEditModal(false);
            setEditingSession(null);
          }}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <Card style={dynamicStyles.modalCard}>
            <Card.Content>
              <Title style={dynamicStyles.modalTitle}>Edit Session</Title>
              
              <TextInput
                label="Session Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({...formData, name: text})}
                style={dynamicStyles.input}
                mode="outlined"
                placeholder="Enter session name"
              />
              
              <TextInput
                label="Alias (Optional)"
                value={formData.alias}
                onChangeText={(text) => setFormData({...formData, alias: text})}
                style={dynamicStyles.input}
                mode="outlined"
                placeholder="Enter alias or leave empty for auto-generation"
              />
              
              <TextInput
                label="Phone Number (Optional)"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({...formData, phoneNumber: text})}
                style={dynamicStyles.input}
                mode="outlined"
                placeholder="Enter phone number"
                keyboardType="phone-pad"
              />
              
              <View style={dynamicStyles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setShowEditModal(false);
                    setEditingSession(null);
                  }}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={updateSession}
                  loading={loading}
                  disabled={loading}
                  style={dynamicStyles.modalButton}
                >
                  Update Session
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>
    </ScrollView>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
    backgroundColor: theme.colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    marginTop: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sessionInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sessionId: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  sessionAlias: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  sessionPhone: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  defaultChip: {
    marginLeft: 8,
    height: 24,
  },
  defaultChipText: {
    fontSize: 10,
  },
  divider: {
    marginVertical: 12,
  },
  sessionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    minWidth: 100,
  },
  deleteButton: {
    borderColor: '#FF3B30',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    textAlign: 'center',
    marginBottom: 20,
    color: theme.colors.onSurface,
  },
  input: {
    marginBottom: 16,
    backgroundColor: theme.colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});

export default SimpleSessionManagementScreen;
