import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, Platform, Alert, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Card, Button, TextInput, Divider, List, Chip, useTheme, Portal, Modal, Title } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppContext } from '../../context/AppContext';
import { customersAPI, messageTemplatesAPI, whatsappAPI } from '../../services/api';
import { areasAPI } from '../../services/areasAPI';
import { enhancedMessageAPI } from '../../services/enhancedMessageAPI';
import { messagesAPI } from '../../services/api';
import { timeRestrictionsAPI } from '../../services/timeRestrictionsAPI';
import { supabase } from '../../services/supabase';
import { formatTimeWithArabicNumerals, formatDateTimeWithArabicNumerals } from '../../utils/numberFormatting';
import WebCompatibleButton from '../components/WebCompatibleButton';

const WebEnhancedMessageScreen = ({ navigation }) => {
  const { userId, t, language, activeSessionId } = useContext(AppContext);
  const paperTheme = useTheme();
  const isFocused = useIsFocused();
  const [customers, setCustomers] = useState([]);
  const [userAreas, setUserAreas] = useState([]);
  const [areaETAs, setAreaETAs] = useState({});
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [sendingResults, setSendingResults] = useState(null);
  const [shouldStop, setShouldStop] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showETAModal, setShowETAModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState(null);
  const [etaTime, setEtaTime] = useState(() => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    return date;
  });
  const [rangeEndTime, setRangeEndTime] = useState(() => {
    const date = new Date();
    date.setHours(13, 0, 0, 0);
    return date;
  });
  const [etaFormat, setEtaFormat] = useState('range');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showRangeEndPicker, setShowRangeEndPicker] = useState(false);
  const [previewMessages, setPreviewMessages] = useState([]);
  const [etaStats, setEtaStats] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedSpeed, setSelectedSpeed] = useState('medium');
  const [backgroundSending, setBackgroundSending] = useState(true);
  const [whatsappStatus, setWhatsappStatus] = useState({ 
    connected: false, 
    connecting: false,
    activeSessionId: null
  });
  const [whatsappStatusLoading, setWhatsappStatusLoading] = useState(false);
  const [availableSessions, setAvailableSessions] = useState([]);
  const [selectedSessionForSending, setSelectedSessionForSending] = useState(null);
  
  // Enhanced ETA Management states
  const [showCopyETAModal, setShowCopyETAModal] = useState(false);
  const [selectedAreasToCopy, setSelectedAreasToCopy] = useState([]);
  const [showBulkETAModal, setShowBulkETAModal] = useState(false);
  const [bulkETAAction, setBulkETAAction] = useState('add');
  const [etaSaving, setEtaSaving] = useState(false);

  useEffect(() => { 
    if (userId) loadData(); 
  }, [userId]);

  useEffect(() => {
    if (isFocused && userId) {
      console.log('📱 WebEnhancedMessageScreen loaded with userId:', userId);
      loadData();
      loadAvailableSessions();
      checkWhatsAppStatus();
    }
  }, [isFocused, userId, activeSessionId]);

  // Periodic WhatsApp status check when screen is focused
  useEffect(() => {
    let statusInterval;
    
    if (isFocused && userId && activeSessionId) {
      statusInterval = setInterval(() => {
        checkWhatsAppStatus();
      }, 5000);
    }
    
    return () => {
      if (statusInterval) {
        clearInterval(statusInterval);
      }
    };
  }, [isFocused, userId, activeSessionId]);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading data for user:', userId);
      
      const [customersResult, templatesResult, areasResult, profileResult, etaStatsResult] = await Promise.all([
        customersAPI.getCustomers(userId),
        messageTemplatesAPI.getTemplates(userId),
        areasAPI.getUserAreas(userId),
        supabase.from('profiles').select('*').eq('id', userId).single(),
        enhancedMessageAPI.getETAStats(userId)
      ]);

      if (customersResult.success) {
        setCustomers(customersResult.data || []);
        console.log('✅ Loaded customers:', customersResult.data?.length || 0);
      }

      if (templatesResult.success) {
        setMessageTemplates(templatesResult.data || []);
        console.log('✅ Loaded templates:', templatesResult.data?.length || 0);
      }

      if (areasResult.success) {
        setUserAreas(areasResult.data || []);
        console.log('✅ Loaded areas:', areasResult.data?.length || 0);
      }

      if (profileResult.data) {
        setCurrentUserProfile(profileResult.data);
        console.log('✅ Loaded user profile');
      }

      if (etaStatsResult.success) {
        setEtaStats(etaStatsResult.data);
        console.log('✅ Loaded ETA stats');
      }

      // Load area ETAs
      await loadAreaETAs();
      
    } catch (error) {
      console.error('❌ Error loading data:', error);
      Alert.alert(t('error'), 'Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const loadAreaETAs = async () => {
    try {
      const result = await enhancedMessageAPI.getAreaETAs(userId);
      if (result.success) {
        setAreaETAs(result.data || {});
        console.log('✅ Loaded area ETAs:', Object.keys(result.data || {}).length);
      }
    } catch (error) {
      console.error('❌ Error loading area ETAs:', error);
    }
  };

  const loadAvailableSessions = async () => {
    try {
      const result = await whatsappAPI.getSessions(userId);
      if (result.success) {
        setAvailableSessions(result.data || []);
        console.log('✅ Loaded available sessions:', result.data?.length || 0);
      }
    } catch (error) {
      console.error('❌ Error loading sessions:', error);
    }
  };

  const checkWhatsAppStatus = async () => {
    try {
      setWhatsappStatusLoading(true);
      const result = await whatsappAPI.getStatus(userId);
      if (result.success) {
        setWhatsappStatus(result.data);
        console.log('✅ WhatsApp status:', result.data);
      }
    } catch (error) {
      console.error('❌ Error checking WhatsApp status:', error);
    } finally {
      setWhatsappStatusLoading(false);
    }
  };

  const handleSendMessages = async () => {
    if (!selectedTemplate) {
      Alert.alert(t('error'), 'Please select a template');
      return;
    }

    if (!selectedSessionForSending) {
      Alert.alert(t('error'), 'Please select a WhatsApp session');
      return;
    }

    if (customers.length === 0) {
      Alert.alert(t('error'), 'No customers available');
      return;
    }

    Alert.alert(
      t('confirm'),
      `Send messages to ${customers.length} customers using ${selectedSessionForSending.session_name}?`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('sendNow'),
          onPress: async () => {
            try {
              setSending(true);
              setSendingProgress(0);
              setShouldStop(false);
              
              const result = await enhancedMessageAPI.sendBulkMessages(
                selectedTemplate,
                customers,
                userId,
                selectedSessionForSending.session_id,
                selectedSpeed,
                backgroundSending,
                (progress) => {
                  setSendingProgress(progress);
                },
                () => shouldStop
              );

              if (result.success) {
                setSendingResults(result.data);
                Alert.alert(t('success'), `Messages sent successfully! Sent: ${result.data.sentCount}, Failed: ${result.data.failedCount}`);
              } else {
                Alert.alert(t('error'), result.error || 'Failed to send messages');
              }
            } catch (error) {
              console.error('Error sending messages:', error);
              Alert.alert(t('error'), 'Error sending messages');
            } finally {
              setSending(false);
              setSendingProgress(0);
            }
          }
        }
      ]
    );
  };

  const stopSending = () => {
    setShouldStop(true);
    Alert.alert(t('stopping'), 'Stopping message sending...');
  };

  const handleSetETA = async () => {
    if (!selectedArea) {
      Alert.alert(t('error'), t('pleaseSelectArea'));
      return;
    }

    try {
      setEtaSaving(true);
      
      const etaData = {
        areaId: selectedArea.areaId,
        etaTime: etaFormat === 'single' ? etaTime : null,
        startTime: etaFormat === 'range' ? etaTime : null,
        endTime: etaFormat === 'range' ? rangeEndTime : null,
        format: etaFormat
      };

      const result = await enhancedMessageAPI.setAreaETA(userId, etaData);
      
      if (result.success) {
        Alert.alert(t('success'), t('etaSavedSuccessfully'));
        setShowETAModal(false);
        await loadAreaETAs();
      } else {
        Alert.alert(t('error'), result.error || t('failedToSaveETA'));
      }
    } catch (error) {
      console.error('Error setting ETA:', error);
      Alert.alert(t('error'), t('failedToSaveETA'));
    } finally {
      setEtaSaving(false);
    }
  };

  const handleDeleteETA = async (areaId) => {
    Alert.alert(
      t('confirmDelete'),
      'Are you sure you want to delete this ETA?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await enhancedMessageAPI.deleteAreaETA(userId, areaId);
              if (result.success) {
                Alert.alert(t('success'), t('etaDeletedSuccessfully'));
                await loadAreaETAs();
              } else {
                Alert.alert(t('error'), result.error || t('failedToDeleteETA'));
              }
            } catch (error) {
              console.error('Error deleting ETA:', error);
              Alert.alert(t('error'), t('failedToDeleteETA'));
            }
          }
        }
      ]
    );
  };

  const handleCopyETA = (sourceAreaId) => {
    const sourceETA = areaETAs[sourceAreaId];
    if (!sourceETA) return;
    
    setSelectedAreasToCopy([]);
    setShowCopyETAModal(true);
  };

  const handleCopyToSelectedAreas = async () => {
    if (selectedAreasToCopy.length === 0) {
      Alert.alert(t('error'), 'Please select areas to copy to');
      return;
    }

    try {
      setEtaSaving(true);
      
      const sourceAreaId = Object.keys(areaETAs).find(id => areaETAs[id]);
      const sourceETA = areaETAs[sourceAreaId];
      
      if (!sourceETA) {
        Alert.alert(t('error'), 'No source ETA found');
        return;
      }

      const copyPromises = selectedAreasToCopy.map(areaId => 
        enhancedMessageAPI.setAreaETA(userId, {
          areaId,
          etaTime: sourceETA.etaTime,
          startTime: sourceETA.startTime,
          endTime: sourceETA.endTime,
          format: sourceETA.format
        })
      );

      const results = await Promise.all(copyPromises);
      const failed = results.filter(result => !result.success);
      
      if (failed.length === 0) {
        Alert.alert(t('success'), 'ETA copied successfully to all selected areas');
      } else {
        Alert.alert(t('error'), `Failed to copy ETA to ${failed.length} areas`);
      }
      
      setShowCopyETAModal(false);
      await loadAreaETAs();
    } catch (error) {
      console.error('Error copying ETA:', error);
      Alert.alert(t('error'), 'Error copying ETA');
    } finally {
      setEtaSaving(false);
    }
  };

  const handleBulkETAOperation = (action) => {
    setBulkETAAction(action);
    setShowBulkETAModal(true);
  };

  const handleConfirmBulkETA = async () => {
    try {
      setEtaSaving(true);
      
      const areasWithETAs = Object.keys(areaETAs).filter(areaId => areaETAs[areaId]);
      
      const updatePromises = areasWithETAs.map(areaId => {
        const currentETA = areaETAs[areaId];
        let newStartTime = currentETA.startTime;
        let newEndTime = currentETA.endTime;
        
        if (bulkETAAction === 'add') {
          newStartTime = addHourToTime(currentETA.startTime);
          newEndTime = addHourToTime(currentETA.endTime);
        } else {
          newStartTime = deductHourFromTime(currentETA.startTime);
          newEndTime = deductHourFromTime(currentETA.endTime);
        }
        
        return enhancedMessageAPI.setAreaETA(userId, {
          areaId,
          startTime: newStartTime,
          endTime: newEndTime,
          format: currentETA.format
        });
      });

      const results = await Promise.all(updatePromises);
      const failed = results.filter(result => !result.success);
      
      if (failed.length === 0) {
        Alert.alert(t('success'), `Bulk ${bulkETAAction} operation completed successfully`);
      } else {
        Alert.alert(t('error'), `Failed to update ${failed.length} areas`);
      }
      
      setShowBulkETAModal(false);
      await loadAreaETAs();
    } catch (error) {
      console.error('Error in bulk ETA operation:', error);
      Alert.alert(t('error'), 'Error in bulk ETA operation');
    } finally {
      setEtaSaving(false);
    }
  };

  // Helper functions for time manipulation
  const parseTimeString = (timeStr) => {
    if (!timeStr) return new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const addHourToTime = (timeStr) => {
    const date = parseTimeString(timeStr);
    date.setHours(date.getHours() + 1);
    return formatTimeFromDate(date);
  };

  const deductHourFromTime = (timeStr) => {
    const date = parseTimeString(timeStr);
    date.setHours(date.getHours() - 1);
    return formatTimeFromDate(date);
  };

  const formatTimeFromDate = (date) => {
    return date.toTimeString().slice(0, 5);
  };

  const getLocalizedAreaName = (area, language) => {
    if (!area) return t('unknownArea');
    
    switch (language) {
      case 'ar':
        return area.name_arabic || t('unknownArea');
      case 'he':
        return area.name_hebrew || t('unknownArea');
      case 'en':
      default:
        return area.name_english || t('unknownArea');
    }
  };

  const dynamicStyles = {
    container: {
      flex: 1,
      backgroundColor: paperTheme.colors.background,
      padding: 16,
    },
    card: {
      marginBottom: 16,
      backgroundColor: paperTheme.colors.surface,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
      flexWrap: 'wrap',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
      marginBottom: 8,
      flex: 1,
      minWidth: '40%',
    },
    divider: {
      marginVertical: 12,
    },
    noSessionsContainer: {
      padding: 20,
      alignItems: 'center',
    },
    noSessionsText: {
      fontSize: 16,
      color: paperTheme.colors.onSurfaceVariant,
      textAlign: 'center',
      marginBottom: 8,
    },
    noSessionsHelp: {
      fontSize: 14,
      color: paperTheme.colors.onSurfaceVariant,
      textAlign: 'center',
    },
    sessionsList: {
      gap: 8,
    },
    sessionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: paperTheme.colors.surfaceVariant,
      borderRadius: 8,
      marginBottom: 8,
    },
    selectedSession: {
      backgroundColor: paperTheme.colors.primaryContainer,
    },
    sessionInfo: {
      flex: 1,
    },
    sessionName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
    },
    sessionStatus: {
      fontSize: 14,
      color: paperTheme.colors.onSurfaceVariant,
    },
    connectionSection: {
      marginBottom: 16,
      padding: 12,
      backgroundColor: paperTheme.colors.surfaceVariant,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: paperTheme.colors.outline,
    },
    connectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    connectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: paperTheme.colors.onSurface,
    },
    connectionIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    connectionStatus: {
      fontSize: 14,
      fontWeight: '500',
    },
    templateSection: {
      marginBottom: 16,
    },
    templateItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: paperTheme.colors.surfaceVariant,
      borderRadius: 8,
      marginBottom: 8,
    },
    selectedTemplate: {
      backgroundColor: paperTheme.colors.primaryContainer,
    },
    templateName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
      flex: 1,
    },
    templateContent: {
      fontSize: 14,
      color: paperTheme.colors.onSurfaceVariant,
      marginTop: 4,
    },
    etaSection: {
      marginBottom: 16,
    },
    areaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: paperTheme.colors.surfaceVariant,
      borderRadius: 8,
      marginBottom: 8,
    },
    areaItemWithETA: {
      backgroundColor: paperTheme.colors.primaryContainer,
    },
    areaName: {
      fontSize: 16,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
      flex: 1,
    },
    etaDisplay: {
      fontSize: 14,
      color: paperTheme.colors.onSurfaceVariant,
      marginRight: 8,
    },
    etaActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    bulkOperationsContainer: {
      marginVertical: 12,
    },
    bulkOperationsTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
      marginBottom: 8,
    },
    bulkOperationsButtons: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    sendSection: {
      marginBottom: 16,
    },
    sendButton: {
      marginTop: 16,
    },
    progressContainer: {
      marginTop: 16,
    },
    progressText: {
      textAlign: 'center',
      color: paperTheme.colors.onSurface,
      marginBottom: 8,
    },
    resultsContainer: {
      marginTop: 16,
      padding: 16,
      backgroundColor: paperTheme.colors.surfaceVariant,
      borderRadius: 8,
    },
    resultsTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
      marginBottom: 8,
    },
    resultItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    resultLabel: {
      color: paperTheme.colors.onSurfaceVariant,
    },
    resultValue: {
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      backgroundColor: paperTheme.colors.surface,
      padding: 20,
      borderRadius: 12,
      width: '90%',
      maxWidth: 500,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: paperTheme.colors.onSurface,
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 16,
    },
  };

  if (loading) {
    return (
      <View style={dynamicStyles.container}>
        <Text style={{ textAlign: 'center', color: paperTheme.colors.onSurface }}>
          {t('loading')}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container}>
      {/* WhatsApp Session Selector */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>{t('chooseWhatsAppSession')}</Text>
            <WebCompatibleButton 
              mode="outlined" 
              onPress={loadAvailableSessions}
              icon="refresh"
              compact
            >
              Refresh
            </WebCompatibleButton>
          </View>
          <Divider style={dynamicStyles.divider} />
          {availableSessions.length === 0 ? (
            <View style={dynamicStyles.noSessionsContainer}>
              <Text style={dynamicStyles.noSessionsText}>{t('noSessionsFound')}</Text>
              <Text style={dynamicStyles.noSessionsHelp}>
                {t('goToWhatsAppTab')}
              </Text>
            </View>
          ) : (
            <View style={dynamicStyles.sessionsList}>
              {availableSessions.map((session) => (
                <TouchableOpacity
                  key={session.session_id}
                  style={[
                    dynamicStyles.sessionItem,
                    selectedSessionForSending?.session_id === session.session_id && dynamicStyles.selectedSession
                  ]}
                  onPress={() => setSelectedSessionForSending(session)}
                >
                  <View style={dynamicStyles.sessionInfo}>
                    <Text style={dynamicStyles.sessionName}>{session.session_name}</Text>
                    <Text style={dynamicStyles.sessionStatus}>
                      {session.status} • {session.phone_number || 'No phone'}
                    </Text>
                  </View>
                  {selectedSessionForSending?.session_id === session.session_id && (
                    <Ionicons name="checkmark-circle" size={24} color="#25D366" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* WhatsApp Connection Status */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.connectionSection}>
            <View style={dynamicStyles.connectionHeader}>
              <Text style={dynamicStyles.connectionTitle}>{t('whatsAppStatus')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[
                  dynamicStyles.connectionIndicator,
                  { backgroundColor: whatsappStatus.connected ? '#4CAF50' : '#F44336' }
                ]} />
                <Text style={[
                  dynamicStyles.connectionStatus,
                  { color: whatsappStatus.connected ? '#4CAF50' : '#F44336' }
                ]}>
                  {whatsappStatus.connected ? t('connected') : t('disconnected')}
                </Text>
                <WebCompatibleButton 
                  mode="outlined" 
                  onPress={checkWhatsAppStatus}
                  icon="refresh"
                  compact
                  loading={whatsappStatusLoading}
                >
                  Refresh
                </WebCompatibleButton>
              </View>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Message Templates */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>{t('messageTemplates')}</Text>
            <WebCompatibleButton 
              mode="outlined" 
              onPress={() => setShowTemplateModal(true)}
              icon="plus"
            >
              {t('add')}
            </WebCompatibleButton>
          </View>
          <Divider style={dynamicStyles.divider} />
          {messageTemplates.length === 0 ? (
            <Text style={{ textAlign: 'center', color: paperTheme.colors.onSurfaceVariant, fontStyle: 'italic' }}>
              {t('noTemplates')}
            </Text>
          ) : (
            <View style={dynamicStyles.templateSection}>
              {messageTemplates.map((template) => (
                <TouchableOpacity
                  key={template.id}
                  style={[
                    dynamicStyles.templateItem,
                    selectedTemplate?.id === template.id && dynamicStyles.selectedTemplate
                  ]}
                  onPress={() => setSelectedTemplate(template)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={dynamicStyles.templateName}>{template.name}</Text>
                    <Text style={dynamicStyles.templateContent}>
                      {template.template_english || template.template || 'No content'}
                    </Text>
                  </View>
                  {selectedTemplate?.id === template.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#25D366" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* ETA Management Section */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>{t('yourAreaETAs')}</Text>
            <WebCompatibleButton 
              mode="outlined" 
              onPress={() => setShowETAModal(true)}
              icon="plus"
            >
              {t('addETA')}
            </WebCompatibleButton>
          </View>
          <Divider style={dynamicStyles.divider} />
          
          {/* Bulk Operations */}
          <View style={dynamicStyles.bulkOperationsContainer}>
            <Text style={dynamicStyles.bulkOperationsTitle}>{t('bulkOperations')}</Text>
            <View style={dynamicStyles.bulkOperationsButtons}>
              <WebCompatibleButton 
                mode="outlined" 
                onPress={() => handleBulkETAOperation('add')}
                icon="plus"
              >
                {t('addHourToAllETAs')}
              </WebCompatibleButton>
              <WebCompatibleButton 
                mode="outlined" 
                onPress={() => handleBulkETAOperation('deduct')}
                icon="minus"
              >
                {t('deductHourFromAllETAs')}
              </WebCompatibleButton>
            </View>
          </View>

          <Divider style={dynamicStyles.divider} />
          
          {userAreas.length === 0 ? (
            <Text style={{ textAlign: 'center', color: paperTheme.colors.onSurfaceVariant, fontStyle: 'italic' }}>
              {t('noAreas')}
            </Text>
          ) : (
            <View style={dynamicStyles.etaSection}>
              {userAreas.map((area) => {
                const eta = areaETAs[area.areaId];
                return (
                  <View key={area.areaId} style={[
                    dynamicStyles.areaItem,
                    eta && dynamicStyles.areaItemWithETA
                  ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={dynamicStyles.areaName}>
                        {getLocalizedAreaName(area, language)}
                      </Text>
                      {eta ? (
                        <Text style={dynamicStyles.etaDisplay}>
                          {eta.format === 'single' 
                            ? formatTimeWithArabicNumerals(eta.etaTime)
                            : `${formatTimeWithArabicNumerals(eta.startTime)} - ${formatTimeWithArabicNumerals(eta.endTime)}`
                          }
                        </Text>
                      ) : (
                        <Text style={dynamicStyles.etaDisplay}>{t('notSet')}</Text>
                      )}
                    </View>
                    <View style={dynamicStyles.etaActions}>
                      {eta && (
                        <>
                          <WebCompatibleButton 
                            mode="outlined" 
                            onPress={() => handleCopyETA(area.areaId)}
                            icon="content-copy"
                            compact
                          >
                            {t('copyETA')}
                          </WebCompatibleButton>
                          <WebCompatibleButton 
                            mode="outlined" 
                            onPress={() => handleDeleteETA(area.areaId)}
                            icon="delete"
                            compact
                            style={{ borderColor: '#F44336' }}
                            labelStyle={{ color: '#F44336' }}
                          >
                            {t('deleteETA')}
                          </WebCompatibleButton>
                        </>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Send Messages Section */}
      <Card style={dynamicStyles.card}>
        <Card.Content>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>{t('sendMessages')}</Text>
          </View>
          <Divider style={dynamicStyles.divider} />
          
          <View style={dynamicStyles.sendSection}>
            <Text style={{ color: paperTheme.colors.onSurface, marginBottom: 8 }}>
              {t('customers')}: {customers.length}
            </Text>
            <Text style={{ color: paperTheme.colors.onSurface, marginBottom: 8 }}>
              {t('selectedTemplate')}: {selectedTemplate?.name || t('none')}
            </Text>
            <Text style={{ color: paperTheme.colors.onSurface, marginBottom: 16 }}>
              {t('selectedSession')}: {selectedSessionForSending?.session_name || t('none')}
            </Text>
            
            <WebCompatibleButton
              onPress={handleSendMessages}
              mode="contained"
              icon="send"
              loading={sending}
              disabled={!selectedTemplate || !selectedSessionForSending || customers.length === 0 || sending}
              style={dynamicStyles.sendButton}
            >
              {sending ? t('sending') : t('sendNow')}
            </WebCompatibleButton>
            
            {sending && (
              <View style={dynamicStyles.progressContainer}>
                <Text style={dynamicStyles.progressText}>
                  {t('sending')}... {Math.round(sendingProgress)}%
                </Text>
                <WebCompatibleButton
                  onPress={stopSending}
                  mode="outlined"
                  icon="stop"
                  style={{ borderColor: '#F44336' }}
                  labelStyle={{ color: '#F44336' }}
                >
                  {t('stopSending')}
                </WebCompatibleButton>
              </View>
            )}
            
            {sendingResults && (
              <View style={dynamicStyles.resultsContainer}>
                <Text style={dynamicStyles.resultsTitle}>{t('sendResults')}</Text>
                <View style={dynamicStyles.resultItem}>
                  <Text style={dynamicStyles.resultLabel}>{t('totalSent')}:</Text>
                  <Text style={dynamicStyles.resultValue}>{sendingResults.sentCount}</Text>
                </View>
                <View style={dynamicStyles.resultItem}>
                  <Text style={dynamicStyles.resultLabel}>{t('totalFailed')}:</Text>
                  <Text style={dynamicStyles.resultValue}>{sendingResults.failedCount}</Text>
                </View>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>

      {/* ETA Modal */}
      <Portal>
        <Modal
          visible={showETAModal}
          onDismiss={() => setShowETAModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <Title style={dynamicStyles.modalTitle}>{t('addETA')}</Title>
            
            <TextInput
              label={t('selectArea')}
              value={selectedArea ? getLocalizedAreaName(selectedArea, language) : ''}
              mode="outlined"
              editable={false}
              style={{ marginBottom: 16 }}
            />
            
            <View style={{ marginBottom: 16 }}>
              <Text style={{ marginBottom: 8, color: paperTheme.colors.onSurface }}>
                {t('etaFormat')}:
              </Text>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity
                  style={{
                    padding: 12,
                    backgroundColor: etaFormat === 'single' ? paperTheme.colors.primary : paperTheme.colors.surfaceVariant,
                    borderRadius: 8,
                    flex: 1,
                    alignItems: 'center'
                  }}
                  onPress={() => setEtaFormat('single')}
                >
                  <Text style={{ color: etaFormat === 'single' ? '#fff' : paperTheme.colors.onSurface }}>
                    {t('singleTime')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    padding: 12,
                    backgroundColor: etaFormat === 'range' ? paperTheme.colors.primary : paperTheme.colors.surfaceVariant,
                    borderRadius: 8,
                    flex: 1,
                    alignItems: 'center'
                  }}
                  onPress={() => setEtaFormat('range')}
                >
                  <Text style={{ color: etaFormat === 'range' ? '#fff' : paperTheme.colors.onSurface }}>
                    {t('timeRange')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={dynamicStyles.modalActions}>
              <WebCompatibleButton
                onPress={() => setShowETAModal(false)}
                mode="outlined"
              >
                {t('cancel')}
              </WebCompatibleButton>
              <WebCompatibleButton
                onPress={handleSetETA}
                mode="contained"
                loading={etaSaving}
                disabled={etaSaving}
              >
                {t('saveETA')}
              </WebCompatibleButton>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Copy ETA Modal */}
      <Portal>
        <Modal
          visible={showCopyETAModal}
          onDismiss={() => setShowCopyETAModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <Title style={dynamicStyles.modalTitle}>{t('copyETAToOtherAreas')}</Title>
            
            <Text style={{ marginBottom: 16, color: paperTheme.colors.onSurface }}>
              Select areas to copy the ETA to:
            </Text>
            
            {userAreas.map((area) => (
              <TouchableOpacity
                key={area.areaId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  backgroundColor: paperTheme.colors.surfaceVariant,
                  borderRadius: 8,
                  marginBottom: 8
                }}
                onPress={() => {
                  if (selectedAreasToCopy.includes(area.areaId)) {
                    setSelectedAreasToCopy(prev => prev.filter(id => id !== area.areaId));
                  } else {
                    setSelectedAreasToCopy(prev => [...prev, area.areaId]);
                  }
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: paperTheme.colors.onSurface }}>
                    {getLocalizedAreaName(area, language)}
                  </Text>
                </View>
                {selectedAreasToCopy.includes(area.areaId) && (
                  <Ionicons name="checkmark-circle" size={24} color="#25D366" />
                )}
              </TouchableOpacity>
            ))}
            
            <View style={dynamicStyles.modalActions}>
              <WebCompatibleButton
                onPress={() => setShowCopyETAModal(false)}
                mode="outlined"
              >
                {t('cancel')}
              </WebCompatibleButton>
              <WebCompatibleButton
                onPress={handleCopyToSelectedAreas}
                mode="contained"
                loading={etaSaving}
                disabled={etaSaving || selectedAreasToCopy.length === 0}
              >
                {t('copyETA')}
              </WebCompatibleButton>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* Bulk ETA Modal */}
      <Portal>
        <Modal
          visible={showBulkETAModal}
          onDismiss={() => setShowBulkETAModal(false)}
          contentContainerStyle={dynamicStyles.modalContainer}
        >
          <View style={dynamicStyles.modalContent}>
            <Title style={dynamicStyles.modalTitle}>
              {bulkETAAction === 'add' ? t('confirmAddHour') : t('confirmDeductHour')}
            </Title>
            
            <Text style={{ marginBottom: 16, color: paperTheme.colors.onSurface }}>
              {bulkETAAction === 'add' 
                ? 'This will add 1 hour to all existing ETAs. Continue?'
                : 'This will deduct 1 hour from all existing ETAs. Continue?'
              }
            </Text>
            
            <View style={dynamicStyles.modalActions}>
              <WebCompatibleButton
                onPress={() => setShowBulkETAModal(false)}
                mode="outlined"
              >
                {t('cancel')}
              </WebCompatibleButton>
              <WebCompatibleButton
                onPress={handleConfirmBulkETA}
                mode="contained"
                loading={etaSaving}
                disabled={etaSaving}
              >
                {t('confirm')}
              </WebCompatibleButton>
            </View>
          </View>
        </Modal>
      </Portal>
    </ScrollView>
  );
};

export default WebEnhancedMessageScreen;