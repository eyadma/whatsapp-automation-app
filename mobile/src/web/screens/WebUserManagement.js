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

const WebUserManagement = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading users:', error);
        Alert.alert('Error', 'Failed to load users');
        return;
      }

      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = () => {
    setFormData({
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
    });
    setEditingUser(null);
    setShowAddModal(true);
  };

  const handleEditUser = (user) => {
    setFormData({
      email: user.email || '',
      password: '',
      confirmPassword: '',
      role: user.role || 'user',
    });
    setEditingUser(user);
    setShowAddModal(true);
  };

  const handleSaveUser = async () => {
    if (!formData.email.trim()) {
      Alert.alert('Error', 'Email is required');
      return;
    }

    if (!editingUser && !formData.password.trim()) {
      Alert.alert('Error', 'Password is required for new users');
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      if (editingUser) {
        // Update existing user
        const updateData = {
          email: formData.email.trim(),
          role: formData.role,
        };

        if (formData.password.trim()) {
          updateData.password = formData.password.trim();
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingUser.id);

        if (error) {
          console.error('Error updating user:', error);
          Alert.alert('Error', 'Failed to update user');
          return;
        }

        Alert.alert('Success', 'User updated successfully');
      } else {
        // Create new user
        const { error } = await supabase
          .from('users')
          .insert([{
            email: formData.email.trim(),
            password: formData.password.trim(),
            role: formData.role,
          }]);

        if (error) {
          console.error('Error creating user:', error);
          Alert.alert('Error', 'Failed to create user');
          return;
        }

        Alert.alert('Success', 'User created successfully');
      }

      setShowAddModal(false);
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user',
      });
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      Alert.alert('Error', 'Failed to save user');
    }
  };

  const handleDeleteUser = (user) => {
    if (user.id === userId) {
      Alert.alert('Error', 'You cannot delete your own account');
      return;
    }

    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete user "${user.email}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', user.id);

              if (error) {
                console.error('Error deleting user:', error);
                Alert.alert('Error', 'Failed to delete user');
                return;
              }

              Alert.alert('Success', 'User deleted successfully');
              loadUsers();
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#F44336';
      case 'user': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  const getRoleText = (role) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'user': return 'User';
      default: return 'Unknown';
    }
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.role && user.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          User Management
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Manage system users and their permissions
        </WebCompatibleParagraph>
      </View>

      {/* Search and Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <View style={dynamicStyles.searchContainer}>
            <WebCompatibleTextInput
              label="Search users..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={dynamicStyles.searchInput}
            />
            <WebCompatibleButton
              mode="contained"
              onPress={handleAddUser}
              style={dynamicStyles.addButton}
            >
              Add User
            </WebCompatibleButton>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Users List */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Users ({filteredUsers.length})
          </WebCompatibleTitle>
          
          {filteredUsers.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <WebCompatibleTitle style={dynamicStyles.emptyTitle}>
                {searchQuery ? 'No users found' : 'No users yet'}
              </WebCompatibleTitle>
              <WebCompatibleParagraph style={dynamicStyles.emptySubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Add your first user to get started'
                }
              </WebCompatibleParagraph>
            </View>
          ) : (
            <View style={dynamicStyles.usersList}>
              {filteredUsers.map(user => (
                <View key={user.id} style={dynamicStyles.userItem}>
                  <View style={dynamicStyles.userInfo}>
                    <Text style={dynamicStyles.userEmail}>{user.email}</Text>
                    <View style={dynamicStyles.userDetails}>
                      <View style={[
                        dynamicStyles.roleBadge,
                        { backgroundColor: getRoleColor(user.role) }
                      ]}>
                        <Text style={dynamicStyles.roleText}>
                          {getRoleText(user.role)}
                        </Text>
                      </View>
                      <Text style={dynamicStyles.userDate}>
                        Created: {new Date(user.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <View style={dynamicStyles.userActions}>
                    <WebCompatibleButton
                      mode="outlined"
                      onPress={() => handleEditUser(user)}
                      style={dynamicStyles.actionButton}
                    >
                      Edit
                    </WebCompatibleButton>
                    {user.id !== userId && (
                      <WebCompatibleButton
                        mode="outlined"
                        onPress={() => handleDeleteUser(user)}
                        style={[dynamicStyles.actionButton, dynamicStyles.deleteButton]}
                      >
                        Delete
                      </WebCompatibleButton>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Add/Edit User Modal */}
      {showAddModal && (
        <View style={dynamicStyles.modalOverlay}>
          <WebCompatibleCard style={dynamicStyles.modalCard}>
            <WebCompatibleCard.Content>
              <WebCompatibleTitle style={dynamicStyles.modalTitle}>
                {editingUser ? 'Edit User' : 'Add New User'}
              </WebCompatibleTitle>
              
              <WebCompatibleTextInput
                label="Email *"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                style={dynamicStyles.input}
              />
              
              <WebCompatibleTextInput
                label={editingUser ? "New Password (leave blank to keep current)" : "Password *"}
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry
                style={dynamicStyles.input}
              />
              
              {formData.password && (
                <WebCompatibleTextInput
                  label="Confirm Password *"
                  value={formData.confirmPassword}
                  onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                  secureTextEntry
                  style={dynamicStyles.input}
                />
              )}
              
              <WebCompatiblePicker
                selectedValue={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                style={dynamicStyles.picker}
              >
                <WebCompatiblePicker.Item label="User" value="user" />
                <WebCompatiblePicker.Item label="Administrator" value="admin" />
              </WebCompatiblePicker>
              
              <View style={dynamicStyles.modalActions}>
                <WebCompatibleButton
                  mode="outlined"
                  onPress={() => setShowAddModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </WebCompatibleButton>
                <WebCompatibleButton
                  mode="contained"
                  onPress={handleSaveUser}
                  style={dynamicStyles.modalButton}
                >
                  {editingUser ? 'Update User' : 'Add User'}
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
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
  },
  searchInput: {
    flex: 1,
  },
  addButton: {
    minWidth: 120,
  },
  emptyContainer: {
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
  usersList: {
    gap: 16,
  },
  userItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  userDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  userDate: {
    fontSize: 14,
    color: '#666666',
  },
  userActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    minWidth: 80,
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
  input: {
    marginBottom: 16,
  },
  picker: {
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

export default WebUserManagement;
