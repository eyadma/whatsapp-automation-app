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
  Title,
  Paragraph,
  Button,
  Searchbar,
  Chip,
  List,
  Divider,
  FAB,
  Portal,
  Modal,
  TextInput,
  SegmentedButtons,
  Switch,
  useTheme,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { AppContext } from '../context/AppContext';
import { formatDateWithArabicNumerals } from '../utils/numberFormatting';

const UserManagement = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'regular',
  });
  const [addingUser, setAddingUser] = useState(false);
  const [showTimeRestrictionModal, setShowTimeRestrictionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [timeRestrictionData, setTimeRestrictionData] = useState({
    time_restriction_enabled: false,
    time_restriction_start: '09:00',
    time_restriction_end: '12:30',
    time_restriction_timezone: 'Asia/Jerusalem'
  });
  const [updatingRestrictions, setUpdatingRestrictions] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
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

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleFilterRole = (role) => {
    setFilterRole(role);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        console.error('Error updating user role:', error);
        Alert.alert('Error', 'Failed to update user role');
        return;
      }

      Alert.alert('Success', 'User role updated successfully');
      loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      Alert.alert('Error', 'Failed to update user role');
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${userEmail}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', userId);

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

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.fullName) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newUser.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    try {
      setAddingUser(true);

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        email_confirm: true,
      });

      if (authError) {
        console.error('Error creating user in auth:', authError);
        Alert.alert('Error', authError.message);
        return;
      }

      // Create profile record
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: newUser.email,
          full_name: newUser.fullName,
          role: newUser.role,
        });

      if (profileError) {
        console.error('Error creating profile:', profileError);
        Alert.alert('Error', 'Failed to create user profile');
        return;
      }

      Alert.alert('Success', 'User created successfully');
      setShowAddModal(false);
      setNewUser({ email: '', password: '', fullName: '', role: 'regular' });
      loadUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      Alert.alert('Error', 'Failed to create user');
    } finally {
      setAddingUser(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin':
        return '#FF6B6B';
      case 'regular':
        return '#4ECDC4';
      default:
        return '#95A5A6';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin':
        return 'shield-checkmark';
      case 'regular':
        return 'person';
      default:
        return 'help-circle';
    }
  };

  const handleTimeRestrictions = async (user) => {
    try {
      setSelectedUser(user);
      
      // Fetch current time restriction settings
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/time-restrictions/${user.id}`);
      const result = await response.json();
      
      if (result.success) {
        setTimeRestrictionData({
          time_restriction_enabled: result.data.time_restriction_enabled || false,
          time_restriction_start: result.data.time_restriction_start || '09:00',
          time_restriction_end: result.data.time_restriction_end || '12:30',
          time_restriction_timezone: result.data.time_restriction_timezone || 'Asia/Jerusalem'
        });
      } else {
        // Set default values if fetch fails
        setTimeRestrictionData({
          time_restriction_enabled: false,
          time_restriction_start: '09:00',
          time_restriction_end: '12:30',
          time_restriction_timezone: 'Asia/Jerusalem'
        });
      }
      
      setShowTimeRestrictionModal(true);
    } catch (error) {
      console.error('Error fetching time restrictions:', error);
      Alert.alert('Error', 'Failed to load time restrictions');
    }
  };

  const handleUpdateTimeRestrictions = async () => {
    if (!selectedUser) return;
    
    try {
      setUpdatingRestrictions(true);
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/time-restrictions/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(timeRestrictionData),
      });
      
      const result = await response.json();
      
      if (result.success) {
        Alert.alert('Success', 'Time restrictions updated successfully');
        setShowTimeRestrictionModal(false);
        loadUsers(); // Refresh the user list
      } else {
        Alert.alert('Error', result.error || 'Failed to update time restrictions');
      }
    } catch (error) {
      console.error('Error updating time restrictions:', error);
      Alert.alert('Error', 'Failed to update time restrictions');
    } finally {
      setUpdatingRestrictions(false);
    }
  };

  const handleResetUsageTracking = async (user) => {
    try {
      Alert.alert(
        'Reset Usage Tracking',
        'This will reset the user\'s daily messaging usage tracking. They will need to send a message during allowed hours (09:00-12:30) to regain messaging privileges.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Reset', 
            style: 'destructive',
            onPress: async () => {
              try {
                const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'}/api/time-restrictions/${user.id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    time_restriction_enabled: true,
                    time_restriction_start: '09:00',
                    time_restriction_end: '12:30',
                    time_restriction_timezone: 'Asia/Jerusalem'
                  }),
                });
                
                const result = await response.json();
                
                if (result.success) {
                  Alert.alert('Success', 'Usage tracking reset successfully');
                  loadUsers(); // Refresh the user list
                } else {
                  Alert.alert('Error', result.error || 'Failed to reset usage tracking');
                }
              } catch (error) {
                console.error('Error resetting usage tracking:', error);
                Alert.alert('Error', 'Failed to reset usage tracking');
              }
            }
          },
        ]
      );
    } catch (error) {
      console.error('Error showing reset dialog:', error);
    }
  };

  return (
    <View style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <Title style={dynamicStyles.headerTitle}>User Management</Title>
        <Paragraph style={dynamicStyles.headerSubtitle}>Manage system users and permissions</Paragraph>
      </View>

      <View style={dynamicStyles.filters}>
        <Searchbar
          placeholder={t('searchUsers')}
          onChangeText={handleSearch}
          value={searchQuery}
          style={dynamicStyles.searchbar}
        />
        
        <SegmentedButtons
          value={filterRole}
          onValueChange={handleFilterRole}
          buttons={[
            { value: 'all', label: 'All' },
            { value: 'admin', label: 'Admins' },
            { value: 'regular', label: 'Users' },
          ]}
          style={dynamicStyles.filterButtons}
        />
      </View>

      <ScrollView
        style={dynamicStyles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredUsers.map((user) => (
          <Card key={user.id} style={dynamicStyles.userCard}>
            <Card.Content>
              <View style={dynamicStyles.userHeader}>
                <View style={dynamicStyles.userInfo}>
                  <View style={dynamicStyles.userIcon}>
                    <Ionicons
                      name={getRoleIcon(user.role)}
                      size={24}
                      color={getRoleColor(user.role)}
                    />
                  </View>
                  <View style={dynamicStyles.userDetails}>
                    <Title style={dynamicStyles.userName}>
                      {user.full_name || 'No Name'}
                    </Title>
                    <Paragraph style={dynamicStyles.userEmail}>{user.email}</Paragraph>
                    <View style={dynamicStyles.userMeta}>
                      <Chip
                        mode="outlined"
                        textStyle={{ color: getRoleColor(user.role) }}
                        style={[dynamicStyles.roleChip, { borderColor: getRoleColor(user.role) }]}
                      >
                        {user.role}
                      </Chip>
                      <Text style={dynamicStyles.userDate}>
                        Joined: {formatDateWithArabicNumerals(new Date(user.created_at))}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={dynamicStyles.userActions}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    const newRole = user.role === 'admin' ? 'regular' : 'admin';
                    handleUpdateRole(user.id, newRole);
                  }}
                  style={dynamicStyles.actionButton}
                  disabled={user.id === userId}
                >
                  {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={() => handleTimeRestrictions(user)}
                  style={dynamicStyles.actionButton}
                  icon="clock-outline"
                >
                  Time Restrictions
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={() => handleResetUsageTracking(user)}
                  style={dynamicStyles.actionButton}
                  icon="refresh-outline"
                >
                  Reset Usage
                </Button>
                
                <Button
                  mode="outlined"
                  onPress={() => handleDeleteUser(user.id, user.email)}
                  style={[dynamicStyles.actionButton, dynamicStyles.deleteButton]}
                  textColor="#FF6B6B"
                  disabled={user.id === userId}
                >
                  Delete
                </Button>
              </View>
            </Card.Content>
          </Card>
        ))}

        {filteredUsers.length === 0 && !loading && (
          <Card style={dynamicStyles.emptyCard}>
            <Card.Content style={dynamicStyles.emptyContent}>
              <Ionicons name="people-outline" size={48} color="#95A5A6" />
              <Title style={dynamicStyles.emptyTitle}>No users found</Title>
              <Paragraph style={dynamicStyles.emptySubtitle}>
                {searchQuery || filterRole !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'No users have been created yet'}
              </Paragraph>
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <Portal>
        <Modal
          visible={showAddModal}
          onDismiss={() => setShowAddModal(false)}
          contentContainerStyle={dynamicStyles.modal}
        >
          <Card>
            <Card.Content>
              <Title style={dynamicStyles.modalTitle}>Add New User</Title>
              
              <TextInput
                label={t('fullName')}
                value={newUser.fullName}
                onChangeText={(text) => setNewUser({ ...newUser, fullName: text })}
                style={dynamicStyles.input}
                mode="outlined"
              />
              
              <TextInput
                label={t('email')}
                value={newUser.email}
                onChangeText={(text) => setNewUser({ ...newUser, email: text })}
                style={dynamicStyles.input}
                mode="outlined"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              
              <TextInput
                label={t('password')}
                value={newUser.password}
                onChangeText={(text) => setNewUser({ ...newUser, password: text })}
                style={dynamicStyles.input}
                mode="outlined"
                secureTextEntry
              />
              
              <SegmentedButtons
                value={newUser.role}
                onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                buttons={[
                  { value: 'regular', label: 'User' },
                  { value: 'admin', label: 'Admin' },
                ]}
                style={dynamicStyles.roleButtons}
              />
              
              <View style={dynamicStyles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setShowAddModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleAddUser}
                  loading={addingUser}
                  disabled={addingUser}
                  style={dynamicStyles.modalButton}
                >
                  Create User
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      {/* Time Restriction Modal */}
      <Portal>
        <Modal
          visible={showTimeRestrictionModal}
          onDismiss={() => setShowTimeRestrictionModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <Card style={dynamicStyles.modalCard}>
            <Card.Content>
              <Title style={dynamicStyles.modalTitle}>
                {t('timeRestrictions')} - {selectedUser?.full_name || selectedUser?.email}
              </Title>
              
              <View style={dynamicStyles.switchContainer}>
                <Text style={dynamicStyles.switchLabel}>{t('timeRestrictionEnabled')}</Text>
                <Switch
                  value={timeRestrictionData.time_restriction_enabled}
                  onValueChange={(value) => 
                    setTimeRestrictionData({ ...timeRestrictionData, time_restriction_enabled: value })
                  }
                />
              </View>
              
              {timeRestrictionData.time_restriction_enabled && (
                <>
                  <TextInput
                    label={t('startTime')}
                    value={timeRestrictionData.time_restriction_start}
                    onChangeText={(text) => 
                      setTimeRestrictionData({ ...timeRestrictionData, time_restriction_start: text })
                    }
                    style={dynamicStyles.input}
                    placeholder="09:00"
                  />
                  
                  <TextInput
                    label={t('endTime')}
                    value={timeRestrictionData.time_restriction_end}
                    onChangeText={(text) => 
                      setTimeRestrictionData({ ...timeRestrictionData, time_restriction_end: text })
                    }
                    style={dynamicStyles.input}
                    placeholder="12:30"
                  />
                  
                  <TextInput
                    label={t('timezone')}
                    value={timeRestrictionData.time_restriction_timezone}
                    onChangeText={(text) => 
                      setTimeRestrictionData({ ...timeRestrictionData, time_restriction_timezone: text })
                    }
                    style={dynamicStyles.input}
                    placeholder={t('timezonePlaceholder')}
                  />
                  
                  <Paragraph style={dynamicStyles.helpText}>
                    Users can send messages during the specified hours (09:00-12:30). After 12:30, they can only send messages if they used the messaging feature at least once during the allowed hours today.
                  </Paragraph>
                </>
              )}
              
              <View style={dynamicStyles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setShowTimeRestrictionModal(false)}
                  style={dynamicStyles.modalButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleUpdateTimeRestrictions}
                  loading={updatingRestrictions}
                  disabled={updatingRestrictions}
                  style={dynamicStyles.modalButton}
                >
                  Update Restrictions
                </Button>
              </View>
            </Card.Content>
          </Card>
        </Modal>
      </Portal>

      <FAB
        icon="plus"
        style={dynamicStyles.fab}
        onPress={() => setShowAddModal(true)}
        label={t('addUser')}
      />
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
  filters: {
    padding: 15,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  searchbar: {
    marginBottom: 10,
  },
  filterButtons: {
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  userCard: {
    margin: 10,
    marginHorizontal: 15,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
    color: theme.colors.onSurface,
  },
  userEmail: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleChip: {
    height: 24,
  },
  userDate: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  userActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 2,
    marginVertical: 2,
  },
  deleteButton: {
    borderColor: theme.colors.error,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  switchLabel: {
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  helpText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    fontStyle: 'italic',
    marginTop: 10,
  },
  emptyCard: {
    margin: 20,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    marginTop: 15,
    color: theme.colors.onSurfaceVariant,
  },
  emptySubtitle: {
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
    marginTop: 5,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    marginBottom: 20,
    textAlign: 'center',
    color: theme.colors.onSurface,
  },
  input: {
    marginBottom: 15,
  },
  roleButtons: {
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
  },
});

export default UserManagement; 