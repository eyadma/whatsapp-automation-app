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
import WebCompatibleTextInput from '../components/WebCompatibleTextInput';
import WebCompatibleTitle from '../components/WebCompatibleTitle';
import WebCompatibleParagraph from '../components/WebCompatibleParagraph';
import WebCompatibleCard from '../components/WebCompatibleCard';
import WebCompatibleList from '../components/WebCompatibleList';

const WebSimpleSessionManagementScreen = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    phoneNumber: '',
  });

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading sessions:', error);
        Alert.alert('Error', 'Failed to load sessions');
        return;
      }

      setSessions(data || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      Alert.alert('Error', 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const generateAlias = (name) => {
    if (!name) return '';
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3);
  };

  const handleCreateSession = () => {
    setFormData({ name: '', alias: '', phoneNumber: '' });
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
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Session name is required');
      return;
    }

    try {
      const alias = formData.alias.trim() || generateAlias(formData.name);
      
      const { data, error } = await supabase
        .from('whatsapp_sessions')
        .insert([
          {
            user_id: userId,
            session_name: formData.name.trim(),
            session_alias: alias,
            phone_number: formData.phoneNumber.trim() || null,
            status: 'disconnected',
            is_active: true,
          },
        ])
        .select();

      if (error) {
        console.error('Error creating session:', error);
        Alert.alert('Error', 'Failed to create session');
        return;
      }

      Alert.alert('Success', 'Session created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', alias: '', phoneNumber: '' });
      loadSessions();
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create session');
    }
  };

  const updateSession = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Session name is required');
      return;
    }

    try {
      const alias = formData.alias.trim() || generateAlias(formData.name);
      
      const { error } = await supabase
        .from('whatsapp_sessions')
        .update({
          session_name: formData.name.trim(),
          session_alias: alias,
          phone_number: formData.phoneNumber.trim() || null,
        })
        .eq('id', editingSession.id);

      if (error) {
        console.error('Error updating session:', error);
        Alert.alert('Error', 'Failed to update session');
        return;
      }

      Alert.alert('Success', 'Session updated successfully');
      setShowEditModal(false);
      setEditingSession(null);
      setFormData({ name: '', alias: '', phoneNumber: '' });
      loadSessions();
    } catch (error) {
      console.error('Error updating session:', error);
      Alert.alert('Error', 'Failed to update session');
    }
  };

  const deleteSession = async (session) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete "${session.session_name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('whatsapp_sessions')
                .delete()
                .eq('id', session.id);

              if (error) {
                console.error('Error deleting session:', error);
                Alert.alert('Error', 'Failed to delete session');
                return;
              }

              Alert.alert('Success', 'Session deleted successfully');
              loadSessions();
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
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

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Manage WhatsApp Sessions
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Create and manage your WhatsApp connections
        </WebCompatibleParagraph>
      </View>

      <View style={dynamicStyles.actionsContainer}>
        <WebCompatibleButton
          mode="contained"
          onPress={handleCreateSession}
          style={dynamicStyles.createButton}
        >
          Create New Session
        </WebCompatibleButton>
      </View>

      <View style={dynamicStyles.sessionsContainer}>
        {sessions.length === 0 ? (
          <WebCompatibleCard style={dynamicStyles.emptyCard}>
            <WebCompatibleCard.Content>
              <WebCompatibleTitle style={dynamicStyles.emptyTitle}>
                No Sessions Yet
              </WebCompatibleTitle>
              <WebCompatibleParagraph style={dynamicStyles.emptySubtitle}>
                Create your first WhatsApp session to get started
              </WebCompatibleParagraph>
            </WebCompatibleCard.Content>
          </WebCompatibleCard>
        ) : (
          sessions.map((session) => (
            <WebCompatibleCard key={session.id} style={dynamicStyles.sessionCard}>
              <WebCompatibleCard.Content>
                <View style={dynamicStyles.sessionHeader}>
                  <View style={dynamicStyles.sessionInfo}>
                    <WebCompatibleTitle style={dynamicStyles.sessionName}>
                      {session.session_name}
                    </WebCompatibleTitle>
                    {session.session_alias && (
                      <WebCompatibleParagraph style={dynamicStyles.sessionAlias}>
                        Alias: {session.session_alias}
                      </WebCompatibleParagraph>
                    )}
                    {session.phone_number && (
                      <WebCompatibleParagraph style={dynamicStyles.sessionPhone}>
                        Phone: {session.phone_number}
                      </WebCompatibleParagraph>
                    )}
                  </View>
                  <View style={dynamicStyles.sessionStatus}>
                    <View style={[
                      dynamicStyles.statusDot,
                      { backgroundColor: getStatusColor(session.status) }
                    ]} />
                    <Text style={dynamicStyles.statusText}>
                      {getStatusText(session.status)}
                    </Text>
                  </View>
                </View>
                
                <View style={dynamicStyles.sessionActions}>
                  <WebCompatibleButton
                    mode="outlined"
                    onPress={() => handleEditSession(session)}
                    style={dynamicStyles.actionButton}
                  >
                    Edit
                  </WebCompatibleButton>
                  <WebCompatibleButton
                    mode="outlined"
                    onPress={() => deleteSession(session)}
                    style={[dynamicStyles.actionButton, dynamicStyles.deleteButton]}
                  >
                    Delete
                  </WebCompatibleButton>
                </View>
              </WebCompatibleCard.Content>
            </WebCompatibleCard>
          ))
        )}
      </View>

      {/* Create Session Modal */}
      {showCreateModal && (
        <View style={dynamicStyles.modalOverlay}>
          <WebCompatibleCard style={dynamicStyles.modalCard}>
            <WebCompatibleCard.Content>
              <WebCompatibleTitle style={dynamicStyles.modalTitle}>
                Create New Session
              </WebCompatibleTitle>
              
              <WebCompatibleTextInput
                label="Session Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="e.g., Business Account, Support Team"
                style={dynamicStyles.modalInput}
              />
              
              <WebCompatibleTextInput
                label="Session Alias (Optional)"
                value={formData.alias}
                onChangeText={(text) => setFormData({ ...formData, alias: text })}
                placeholder="e.g., BA, ST, DS"
                style={dynamicStyles.modalInput}
              />
              
              <WebCompatibleTextInput
                label="Phone Number (Optional)"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                placeholder="+972501234567"
                keyboardType="phone-pad"
                style={dynamicStyles.modalInput}
              />
              
              <View style={dynamicStyles.modalActions}>
                <WebCompatibleButton
                  mode="outlined"
                  onPress={() => setShowCreateModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </WebCompatibleButton>
                <WebCompatibleButton
                  mode="contained"
                  onPress={createNewSession}
                  style={dynamicStyles.modalButton}
                >
                  Create Session
                </WebCompatibleButton>
              </View>
            </WebCompatibleCard.Content>
          </WebCompatibleCard>
        </View>
      )}

      {/* Edit Session Modal */}
      {showEditModal && (
        <View style={dynamicStyles.modalOverlay}>
          <WebCompatibleCard style={dynamicStyles.modalCard}>
            <WebCompatibleCard.Content>
              <WebCompatibleTitle style={dynamicStyles.modalTitle}>
                Edit Session
              </WebCompatibleTitle>
              
              <WebCompatibleTextInput
                label="Session Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                style={dynamicStyles.modalInput}
              />
              
              <WebCompatibleTextInput
                label="Session Alias (Optional)"
                value={formData.alias}
                onChangeText={(text) => setFormData({ ...formData, alias: text })}
                style={dynamicStyles.modalInput}
              />
              
              <WebCompatibleTextInput
                label="Phone Number (Optional)"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                keyboardType="phone-pad"
                style={dynamicStyles.modalInput}
              />
              
              <View style={dynamicStyles.modalActions}>
                <WebCompatibleButton
                  mode="outlined"
                  onPress={() => setShowEditModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </WebCompatibleButton>
                <WebCompatibleButton
                  mode="contained"
                  onPress={updateSession}
                  style={dynamicStyles.modalButton}
                >
                  Update Session
                </WebCompatibleButton>
              </View>
            </WebCompatibleCard.Content>
          </WebCompatibleCard>
        </View>
      )}
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
  actionsContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  createButton: {
    minWidth: 200,
  },
  sessionsContainer: {
    gap: 16,
  },
  emptyCard: {
    textAlign: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  sessionCard: {
    marginBottom: 16,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
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
  },
  sessionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
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
  sessionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  deleteButton: {
    borderColor: '#F44336',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCard: {
    width: '90%',
    maxWidth: 500,
    margin: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
  },
});

export default WebSimpleSessionManagementScreen;
