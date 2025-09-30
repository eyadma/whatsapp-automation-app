import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Card, Button, TextInput, FAB, List, Chip, IconButton, Portal, Modal, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { AppContext } from '../../context/AppContext';
import { messageTemplatesAPI } from '../../services/api';

const AdminTemplateManagement = () => {
  const { userId, t, language } = useContext(AppContext);
  const paperTheme = useTheme();
  const dynamicStyles = createStyles(paperTheme);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [activeField, setActiveField] = useState(null); // Track which field is focused
  const [formData, setFormData] = useState({
    name: '',
    template_arabic: '',
    template_hebrew: '',
    template_english: '',
    is_global: true,
    is_default: false,
    is_active: true
  });

  useEffect(() => {
    if (userId) loadTemplates();
  }, [userId]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const response = await messageTemplatesAPI.getAll(userId);
      // Filter only global templates for admin management
      const globalTemplates = response.data.templates.filter(t => t.is_global);
      setTemplates(globalTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      Alert.alert(t('error'), 'Failed to load templates: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      template_arabic: '',
      template_hebrew: '',
      template_english: '',
      is_global: true,
      is_default: false,
      is_active: true
    });
    setShowPlaceholders(false); // Reset placeholders visibility
    setActiveField(null); // Reset active field
    setShowModal(true);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      template_arabic: template.template_arabic,
      template_hebrew: template.template_hebrew,
      template_english: template.template_english,
      is_global: template.is_global,
      is_default: template.is_default,
      is_active: template.is_active
    });
    setShowPlaceholders(false); // Reset placeholders visibility
    setActiveField(null); // Reset active field
    setShowModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.name || !formData.template_arabic || !formData.template_hebrew || !formData.template_english) {
      Alert.alert(t('error'), 'Please fill all required fields');
      return;
    }

    try {
      const templateData = {
        ...formData,
        user_id: userId,
        created_by: userId
      };

      if (editingTemplate) {
        await messageTemplatesAPI.update(editingTemplate.id, templateData);
        Alert.alert(t('success'), 'Template updated successfully');
      } else {
        await messageTemplatesAPI.create(templateData);
        Alert.alert(t('success'), 'Template created successfully');
      }

      setShowModal(false);
      loadTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      Alert.alert(t('error'), 'Failed to save template: ' + error.message);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    Alert.alert(
      t('confirm'),
      t('deleteTemplateConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await messageTemplatesAPI.delete(templateId);
              Alert.alert(t('success'), 'Template deleted successfully');
              loadTemplates();
            } catch (error) {
              console.error('Error deleting template:', error);
              Alert.alert(t('error'), 'Failed to delete template: ' + error.message);
            }
          }
        }
      ]
    );
  };

  // Insert placeholder into active field
  const insertPlaceholder = (placeholder) => {
    // If no field is focused, show a selection dialog
    if (!activeField) {
      Alert.alert(
        'Select Template Field',
        'Which template field would you like to insert the placeholder into?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Arabic Template', 
            onPress: () => insertIntoField('template_arabic', placeholder) 
          },
          { 
            text: 'Hebrew Template', 
            onPress: () => insertIntoField('template_hebrew', placeholder) 
          },
          { 
            text: 'English Template', 
            onPress: () => insertIntoField('template_english', placeholder) 
          }
        ]
      );
    } else {
      // Insert directly into the active field
      insertIntoField(activeField, placeholder);
    }
  };

  // Insert placeholder into specific field
  const insertIntoField = (fieldName, placeholder) => {
    const currentValue = formData[fieldName] || '';
    const cursorPosition = currentValue.length; // Insert at end for now
    
    // Insert placeholder at cursor position (or at end if no cursor info)
    const newValue = currentValue.slice(0, cursorPosition) + placeholder + currentValue.slice(cursorPosition);
    
    setFormData(prev => ({
      ...prev,
      [fieldName]: newValue
    }));
    
    // Show confirmation
    Alert.alert(
      'Placeholder Inserted!',
      `"${placeholder}" has been inserted into the ${fieldName.replace('template_', '')} template.`,
      [{ text: 'OK' }]
    );
  };

  const renderTemplateCard = (template) => (
    <Card key={template.id} style={dynamicStyles.templateCard}>
      <Card.Content>
        <View style={dynamicStyles.templateHeader}>
          <View style={dynamicStyles.templateTitle}>
            <Text style={dynamicStyles.templateName}>{template.name}</Text>
            <View style={dynamicStyles.templateChips}>
              {template.is_default && (
                <Chip icon="star" mode="outlined" style={dynamicStyles.defaultChip}>
                  {t('default')}
                </Chip>
              )}
              {template.is_global && (
                <Chip icon="earth" mode="outlined" style={dynamicStyles.globalChip}>
                  {t('global')}
                </Chip>
              )}
              {!template.is_active && (
                <Chip icon="eye-off" mode="outlined" style={dynamicStyles.inactiveChip}>
                  {t('inactive')}
                </Chip>
              )}
            </View>
          </View>
          <View style={dynamicStyles.templateActions}>
            <IconButton
              icon="pencil"
              size={20}
              onPress={() => handleEditTemplate(template)}
            />
            <IconButton
              icon="delete"
              size={20}
              onPress={() => handleDeleteTemplate(template.id)}
            />
          </View>
        </View>

        <View style={dynamicStyles.templatePreview}>
          <Text style={dynamicStyles.previewLabel}>{t('arabic')}:</Text>
          <Text style={dynamicStyles.previewText} numberOfLines={2}>
            {template.template_arabic}
          </Text>
          
          <Text style={dynamicStyles.previewLabel}>{t('hebrew')}:</Text>
          <Text style={dynamicStyles.previewText} numberOfLines={2}>
            {template.template_hebrew}
          </Text>
          
          <Text style={dynamicStyles.previewLabel}>{t('english')}:</Text>
          <Text style={dynamicStyles.previewText} numberOfLines={2}>
            {template.template_english}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.scrollView}>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.title}>{t('templateManagement')}</Text>
          <Text style={dynamicStyles.subtitle}>{t('manageGlobalTemplates')}</Text>
        </View>

        {loading ? (
          <View style={dynamicStyles.loadingContainer}>
            <Text>{t('loading')}</Text>
          </View>
        ) : (
          <View style={dynamicStyles.templatesContainer}>
            {templates.length === 0 ? (
              <Card style={dynamicStyles.emptyCard}>
                <Card.Content>
                  <Text style={dynamicStyles.emptyText}>{t('noTemplates')}</Text>
                  <Text style={dynamicStyles.emptySubtext}>{t('createFirstTemplate')}</Text>
                </Card.Content>
              </Card>
            ) : (
              templates.map(renderTemplateCard)
            )}
          </View>
        )}
      </ScrollView>

      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <ScrollView style={dynamicStyles.modalScroll}>
            <Text style={dynamicStyles.modalTitle}>
              {editingTemplate ? t('editTemplate') : t('addTemplate')}
            </Text>

            {/* Placeholders Toggle Button */}
            <View style={dynamicStyles.placeholdersToggleContainer}>
              <Button
                mode="outlined"
                onPress={() => setShowPlaceholders(!showPlaceholders)}
                icon={showPlaceholders ? "chevron-up" : "chevron-down"}
                style={dynamicStyles.placeholdersToggleButton}
              >
                {showPlaceholders ? 'Hide Placeholders' : 'Show Available Placeholders'}
              </Button>
            </View>

            {/* Available Placeholders - Collapsible */}
            {showPlaceholders && (
              <Card style={dynamicStyles.placeholdersCard}>
                <Card.Content>
                  <Text style={dynamicStyles.placeholdersTitle}>📝 Available Placeholders</Text>
                  <Text style={dynamicStyles.placeholdersSubtitle}>Use these placeholders in your templates:</Text>
                  
                  <View style={dynamicStyles.placeholdersGrid}>
                    <View style={dynamicStyles.placeholderColumn}>
                      <Text style={dynamicStyles.placeholderCategory}>👤 Customer Info:</Text>
                      <TouchableOpacity onPress={() => insertPlaceholder('{name}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{name}'} - Customer name</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => insertPlaceholder('{phone}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{phone}'} - Primary phone</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => insertPlaceholder('{phone2}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{phone2}'} - Secondary phone</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => insertPlaceholder('{business_name}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{business_name}'} - Business name</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={dynamicStyles.placeholderColumn}>
                      <Text style={dynamicStyles.placeholderCategory}>📦 Package Info:</Text>
                      <TouchableOpacity onPress={() => insertPlaceholder('{package_id}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{package_id}'} - Package ID</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => insertPlaceholder('{package_price}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{package_price}'} - Package price</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={dynamicStyles.placeholderColumn}>
                      <Text style={dynamicStyles.placeholderCategory}>📍 Area Names:</Text>
                      <TouchableOpacity onPress={() => insertPlaceholder('{area}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{area}'} - Default area name</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => insertPlaceholder('{area_he}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{area_he}'} - Hebrew area name</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => insertPlaceholder('{area_en}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{area_en}'} - English area name</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => insertPlaceholder('{area_ar}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{area_ar}'} - Arabic area name</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={dynamicStyles.placeholderColumn}>
                      <Text style={dynamicStyles.placeholderCategory}>⏰ Delivery Info:</Text>
                      <TouchableOpacity onPress={() => insertPlaceholder('{eta}')}>
                        <Text style={dynamicStyles.placeholderItem}>{'{eta}'} - Estimated arrival time</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <Text style={dynamicStyles.placeholdersNote}>
                    💡 <Text style={dynamicStyles.placeholdersNoteBold}>Language-specific area placeholders:</Text> Use {'{area_he}'} for Hebrew templates, {'{area_en}'} for English templates, and {'{area_ar}'} for Arabic templates to ensure proper localization.
                  </Text>
                  
                  {activeField && (
                    <Text style={dynamicStyles.activeFieldNote}>
                      🎯 <Text style={dynamicStyles.activeFieldNoteBold}>Active Field:</Text> {activeField.replace('template_', '').charAt(0).toUpperCase() + activeField.replace('template_', '').slice(1)} Template
                    </Text>
                  )}
                </Card.Content>
              </Card>
            )}

            <TextInput
              label={t('templateName')}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              style={dynamicStyles.input}
              mode="outlined"
            />

            <TextInput
              label={`${t('arabic')} ${t('template')}`}
              value={formData.template_arabic}
              onChangeText={(text) => setFormData({ ...formData, template_arabic: text })}
              onFocus={() => setActiveField('template_arabic')}
              style={[
                dynamicStyles.input,
                activeField === 'template_arabic' && dynamicStyles.activeInput
              ]}
              mode="outlined"
              multiline
              numberOfLines={3}
            />

            <TextInput
              label={`${t('hebrew')} ${t('template')}`}
              value={formData.template_hebrew}
              onChangeText={(text) => setFormData({ ...formData, template_hebrew: text })}
              onFocus={() => setActiveField('template_hebrew')}
              style={[
                dynamicStyles.input,
                activeField === 'template_hebrew' && dynamicStyles.activeInput
              ]}
              mode="outlined"
              multiline
              numberOfLines={3}
            />

            <TextInput
              label={`${t('english')} ${t('template')}`}
              value={formData.template_english}
              onChangeText={(text) => setFormData({ ...formData, template_english: text })}
              onFocus={() => setActiveField('template_english')}
              style={[
                dynamicStyles.input,
                activeField === 'template_english' && dynamicStyles.activeInput
              ]}
              mode="outlined"
              multiline
              numberOfLines={3}
            />

            <View style={dynamicStyles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowModal(false)}
                style={dynamicStyles.modalButton}
              >
                {t('cancel')}
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveTemplate}
                style={dynamicStyles.modalButton}
              >
                {editingTemplate ? t('update') : t('create')}
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>

      <FAB
        icon="plus"
        style={dynamicStyles.fab}
        onPress={handleAddTemplate}
        label={t('addTemplate')}
      />
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
    color: theme.colors.onSurface,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  templatesContainer: {
    padding: 16,
  },
  templateCard: {
    marginBottom: 16,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  templateTitle: {
    flex: 1,
  },
  templateName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.colors.onSurface,
  },
  templateChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  defaultChip: {
    backgroundColor: theme.colors.tertiaryContainer,
  },
  globalChip: {
    backgroundColor: theme.colors.primaryContainer,
  },
  inactiveChip: {
    backgroundColor: theme.colors.errorContainer,
  },
  templateActions: {
    flexDirection: 'row',
  },
  templatePreview: {
    marginTop: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.onSurfaceVariant,
    marginTop: 8,
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  emptyCard: {
    marginTop: 20,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 8,
    color: theme.colors.onSurface,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    color: theme.colors.onSurfaceVariant,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    backgroundColor: theme.colors.surface,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalScroll: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: theme.colors.onSurface,
  },
  input: {
    marginBottom: 16,
  },
  activeInput: {
    borderColor: '#007bff',
    borderWidth: 2,
    backgroundColor: '#f8f9ff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
  // Placeholder toggle styles
  placeholdersToggleContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  placeholdersToggleButton: {
    borderColor: '#007bff',
    borderWidth: 1,
    borderRadius: 20,
  },
  // Placeholder styles
  placeholdersCard: {
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  placeholdersTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: 8,
  },
  placeholdersSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  placeholdersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  placeholderColumn: {
    width: '48%',
    marginBottom: 12,
  },
  placeholderCategory: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  placeholderItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'monospace',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  placeholdersNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 16,
  },
  placeholdersNoteBold: {
    fontWeight: 'bold',
    color: '#007bff',
  },
  activeFieldNote: {
    fontSize: 12,
    color: '#28a745',
    marginTop: 12,
    textAlign: 'center',
    padding: 8,
    backgroundColor: '#d4edda',
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#28a745',
  },
  activeFieldNoteBold: {
    fontWeight: 'bold',
    color: '#155724',
  },
});

export default AdminTemplateManagement; 