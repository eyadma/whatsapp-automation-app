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
import WebCompatibleCheckbox from '../components/WebCompatibleCheckbox';

const WebAdminTemplateManagement = ({ navigation }) => {
  const { userId, t, language } = useContext(AppContext);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    template_english: '',
    template_arabic: '',
    template_hebrew: '',
    is_global: false,
    is_active: true,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading templates:', error);
        Alert.alert('Error', 'Failed to load templates');
        return;
      }

      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert('Error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = () => {
    setFormData({
      name: '',
      template_english: '',
      template_arabic: '',
      template_hebrew: '',
      is_global: false,
      is_active: true,
    });
    setEditingTemplate(null);
    setShowAddModal(true);
  };

  const handleEditTemplate = (template) => {
    setFormData({
      name: template.name || '',
      template_english: template.template_english || '',
      template_arabic: template.template_arabic || '',
      template_hebrew: template.template_hebrew || '',
      is_global: template.is_global || false,
      is_active: template.is_active !== false,
    });
    setEditingTemplate(template);
    setShowAddModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Template name is required');
      return;
    }

    if (!formData.template_english.trim()) {
      Alert.alert('Error', 'English template is required');
      return;
    }

    try {
      const templateData = {
        name: formData.name.trim(),
        template_english: formData.template_english.trim(),
        template_arabic: formData.template_arabic.trim() || null,
        template_hebrew: formData.template_hebrew.trim() || null,
        is_global: formData.is_global,
        is_active: formData.is_active,
        user_id: userId,
      };

      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('message_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) {
          console.error('Error updating template:', error);
          Alert.alert('Error', 'Failed to update template');
          return;
        }

        Alert.alert('Success', 'Template updated successfully');
      } else {
        // Create new template
        const { error } = await supabase
          .from('message_templates')
          .insert([templateData]);

        if (error) {
          console.error('Error creating template:', error);
          Alert.alert('Error', 'Failed to create template');
          return;
        }

        Alert.alert('Success', 'Template created successfully');
      }

      setShowAddModal(false);
      setFormData({
        name: '',
        template_english: '',
        template_arabic: '',
        template_hebrew: '',
        is_global: false,
        is_active: true,
      });
      setEditingTemplate(null);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert('Error', 'Failed to save template');
    }
  };

  const handleDeleteTemplate = (template) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete template "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('message_templates')
                .delete()
                .eq('id', template.id);

              if (error) {
                console.error('Error deleting template:', error);
                Alert.alert('Error', 'Failed to delete template');
                return;
              }

              Alert.alert('Success', 'Template deleted successfully');
              loadTemplates();
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert('Error', 'Failed to delete template');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (isActive) => {
    return isActive ? '#4CAF50' : '#F44336';
  };

  const getStatusText = (isActive) => {
    return isActive ? 'Active' : 'Inactive';
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (template.template_english && template.template_english.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (template.template_arabic && template.template_arabic.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (template.template_hebrew && template.template_hebrew.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const dynamicStyles = createStyles();

  if (loading) {
    return (
      <View style={dynamicStyles.loadingContainer}>
        <Text style={dynamicStyles.loadingText}>Loading templates...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      <View style={dynamicStyles.header}>
        <WebCompatibleTitle style={dynamicStyles.title}>
          Template Management
        </WebCompatibleTitle>
        <WebCompatibleParagraph style={dynamicStyles.subtitle}>
          Manage message templates for all users
        </WebCompatibleParagraph>
      </View>

      {/* Search and Actions */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <View style={dynamicStyles.searchContainer}>
            <WebCompatibleTextInput
              label="Search templates..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={dynamicStyles.searchInput}
            />
            <WebCompatibleButton
              mode="contained"
              onPress={handleAddTemplate}
              style={dynamicStyles.addButton}
            >
              Add Template
            </WebCompatibleButton>
          </View>
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Templates List */}
      <WebCompatibleCard style={dynamicStyles.section}>
        <WebCompatibleCard.Content>
          <WebCompatibleTitle style={dynamicStyles.sectionTitle}>
            Templates ({filteredTemplates.length})
          </WebCompatibleTitle>
          
          {filteredTemplates.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <WebCompatibleTitle style={dynamicStyles.emptyTitle}>
                {searchQuery ? 'No templates found' : 'No templates yet'}
              </WebCompatibleTitle>
              <WebCompatibleParagraph style={dynamicStyles.emptySubtitle}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'Add your first template to get started'
                }
              </WebCompatibleParagraph>
            </View>
          ) : (
            <View style={dynamicStyles.templatesList}>
              {filteredTemplates.map(template => (
                <View key={template.id} style={dynamicStyles.templateItem}>
                  <View style={dynamicStyles.templateInfo}>
                    <Text style={dynamicStyles.templateName}>{template.name}</Text>
                    <View style={dynamicStyles.templateDetails}>
                      <View style={[
                        dynamicStyles.statusBadge,
                        { backgroundColor: getStatusColor(template.is_active) }
                      ]}>
                        <Text style={dynamicStyles.statusText}>
                          {getStatusText(template.is_active)}
                        </Text>
                      </View>
                      {template.is_global && (
                        <View style={dynamicStyles.globalBadge}>
                          <Text style={dynamicStyles.globalText}>Global</Text>
                        </View>
                      )}
                    </View>
                    <Text style={dynamicStyles.templatePreview}>
                      {template.template_english.substring(0, 100)}
                      {template.template_english.length > 100 ? '...' : ''}
                    </Text>
                    <Text style={dynamicStyles.templateDate}>
                      Created: {new Date(template.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={dynamicStyles.templateActions}>
                    <WebCompatibleButton
                      mode="outlined"
                      onPress={() => handleEditTemplate(template)}
                      style={dynamicStyles.actionButton}
                    >
                      Edit
                    </WebCompatibleButton>
                    <WebCompatibleButton
                      mode="outlined"
                      onPress={() => handleDeleteTemplate(template)}
                      style={[dynamicStyles.actionButton, dynamicStyles.deleteButton]}
                    >
                      Delete
                    </WebCompatibleButton>
                  </View>
                </View>
              ))}
            </View>
          )}
        </WebCompatibleCard.Content>
      </WebCompatibleCard>

      {/* Add/Edit Template Modal */}
      {showAddModal && (
        <View style={dynamicStyles.modalOverlay}>
          <WebCompatibleCard style={dynamicStyles.modalCard}>
            <WebCompatibleCard.Content>
              <WebCompatibleTitle style={dynamicStyles.modalTitle}>
                {editingTemplate ? 'Edit Template' : 'Add New Template'}
              </WebCompatibleTitle>
              
              <WebCompatibleTextInput
                label="Template Name *"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                style={dynamicStyles.input}
              />
              
              <WebCompatibleTextInput
                label="English Template *"
                value={formData.template_english}
                onChangeText={(text) => setFormData({ ...formData, template_english: text })}
                multiline
                numberOfLines={4}
                style={dynamicStyles.textArea}
              />
              
              <WebCompatibleTextInput
                label="Arabic Template (Optional)"
                value={formData.template_arabic}
                onChangeText={(text) => setFormData({ ...formData, template_arabic: text })}
                multiline
                numberOfLines={4}
                style={dynamicStyles.textArea}
              />
              
              <WebCompatibleTextInput
                label="Hebrew Template (Optional)"
                value={formData.template_hebrew}
                onChangeText={(text) => setFormData({ ...formData, template_hebrew: text })}
                multiline
                numberOfLines={4}
                style={dynamicStyles.textArea}
              />
              
              <View style={dynamicStyles.checkboxContainer}>
                <WebCompatibleCheckbox
                  status={formData.is_global ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, is_global: !formData.is_global })}
                />
                <Text style={dynamicStyles.checkboxLabel}>Global Template</Text>
              </View>
              
              <View style={dynamicStyles.checkboxContainer}>
                <WebCompatibleCheckbox
                  status={formData.is_active ? 'checked' : 'unchecked'}
                  onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
                />
                <Text style={dynamicStyles.checkboxLabel}>Active</Text>
              </View>
              
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
                  onPress={handleSaveTemplate}
                  style={dynamicStyles.modalButton}
                >
                  {editingTemplate ? 'Update Template' : 'Add Template'}
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
  templatesList: {
    gap: 16,
  },
  templateItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  templateDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  globalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FF9800',
  },
  globalText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  templatePreview: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 20,
  },
  templateDate: {
    fontSize: 12,
    color: '#999999',
  },
  templateActions: {
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
    maxWidth: 600,
    margin: 20,
    maxHeight: '90vh',
    overflow: 'auto',
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
  textArea: {
    marginBottom: 16,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333333',
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

export default WebAdminTemplateManagement;
